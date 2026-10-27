#!/usr/bin/env node
import process from 'node:process';
import { detectStack } from './core/detect-stack.js';
import { initProject } from './core/project-state.js';
import { getChangeSet, type ChangeScope } from './core/git.js';
import { assessRisk } from './core/risk-engine.js';
import { runProof } from './core/proof-engine.js';
import { destinationFor, findLegacySkills, installSkills, type InstallScope, type InstallTarget } from './core/install.js';
import { doctor } from './core/doctor.js';
import { CONFIG_PATH, loadConfig } from './core/config.js';
import { proveRegression, restoreInterruptedProof, type ProofPhase, type RegressionReport } from './core/regression.js';

const VERSION = '0.3.0';

function usage(): void {
  console.log(`SeniorOS ${VERSION}\n\nUsage:\n  senior init\n  senior inspect [--json]\n  senior risk [--base <ref>] [--json]\n  senior finish [--json]\n  senior prove --regression --test "<command>" [--base <ref>] [--fix <path>]... [--expect-failure <regex>] [--timeout <seconds>] [--json]\n  senior prove --restore\n  senior doctor [--json]\n  senior install --target <claude|codex|generic> [--scope <project|user>] [--force]\n`);
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function valuesAfter(args: string[], flag: string): string[] {
  const values: string[] = [];
  args.forEach((arg, index) => {
    if (arg !== flag) return;
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    values.push(value);
  });
  return values;
}

const PHASE_LABEL: Record<ProofPhase, string> = {
  'with-fix': '1. with the fix      ',
  'without-fix': '2. without the fix   ',
  restored: '3. fix restored      '
};

function formatRegression(report: RegressionReport): string {
  const lines = [
    `Regression proof: ${report.verdict === 'proven' ? 'PROVEN' : 'NOT PROVEN'}${report.verdict === 'proven' ? '' : ` (${report.reason})`}`,
    `  ${report.message}`,
    `  Compared with: ${report.scope === 'base' ? `${report.base} (merge-base ${report.revision.slice(0, 7)})` : `HEAD ${report.revision.slice(0, 7)}`}`,
    `  Fix files, reverted for run 2: ${report.fixFiles.join(', ')}`,
    `  Test files, kept in place:     ${report.testFiles.join(', ') || '(none changed)'}`
  ];
  for (const run of report.runs) {
    const expected = run.phase === 'without-fix' ? !run.passed : run.passed;
    const result = run.timedOut ? 'TIMEOUT' : run.passed ? 'PASS' : 'FAIL';
    lines.push(`  ${PHASE_LABEL[run.phase]}${result.padEnd(7)} exit ${run.exitCode ?? '-'}  ${(run.durationMs / 1000).toFixed(1)}s  ${expected ? 'as expected' : 'UNEXPECTED'}`);
  }
  if (report.restored.files > 0) lines.push(`  Working tree restored and verified (${report.restored.files} file${report.restored.files === 1 ? '' : 's'}, sha256 match).`);
  const surprising = report.runs.find((run) => (run.phase === 'without-fix' ? run.passed : !run.passed) || (run.phase === 'without-fix' && report.reason === 'failed-for-other-reason'));
  if (surprising && report.verdict !== 'proven') lines.push(`\n  Output of run "${surprising.phase}" (last lines):\n${surprising.outputTail.split('\n').map((line) => `    ${line}`).join('\n')}`);
  if (report.evidencePath) lines.push(`  Evidence: ${report.evidencePath}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  const root = process.cwd();
  const json = hasFlag(args, '--json');

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
    return;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(VERSION);
    return;
  }

  if (command === 'init') {
    const result = await initProject(root);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('SeniorOS project state initialized.');
      if (result.created.length) console.log(`Created: ${result.created.join(', ')}`);
      if (result.preserved.length) console.log(`Preserved: ${result.preserved.join(', ')}`);
    }
    return;
  }

  if (command === 'inspect') {
    const result = await detectStack(root);
    console.log(json ? JSON.stringify(result, null, 2) : formatStack(result));
    return;
  }

  if (command === 'risk') {
    const base = valueAfter(args, '--base');
    const config = await loadConfig(root);
    const changeSet = getChangeSet(root, base === undefined ? {} : { base });
    const result = assessRisk(changeSet.files, { extraRules: config?.risk?.rules ?? [], ignore: config?.risk?.ignore ?? [] });
    console.log(json ? JSON.stringify({ scope: changeSet.scope, ...result }, null, 2) : formatRisk(result, changeSet.scope));
    return;
  }

  if (command === 'finish') {
    const config = await loadConfig(root);
    const stack = await detectStack(root);
    // In JSON mode, script output goes to stderr so stdout stays parseable.
    const result = await runProof(root, stack.packageManager, {
      childOutput: json ? 'stderr' : 'inherit',
      ...(config?.proof ? { checks: config.proof.checks } : {})
    });
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const check of result.checks) {
        const detail = [check.command, check.reason].filter(Boolean).join(' — ');
        console.log(`${check.status.toUpperCase().padEnd(4)} ${check.name}${detail ? `  (${detail})` : ''}`);
      }
      const coverage = `${result.availableChecks}/${result.totalChecks}`;
      const kind = result.source === 'config' ? `configured checks from ${CONFIG_PATH}` : 'standard checks available';
      console.log(`\nPROOF BASELINE: ${result.baselinePassed ? 'PASS' : 'NOT PROVEN'} (${coverage} ${kind})`);
      console.log('Final ship readiness still depends on task-specific acceptance criteria and risk.');
    }
    if (!result.baselinePassed) process.exitCode = 1;
    return;
  }

  if (command === 'prove') {
    if (hasFlag(args, '--restore')) {
      const restored = restoreInterruptedProof(root);
      console.log(json ? JSON.stringify({ restored }, null, 2) : `Restored and verified ${restored.length} file(s):\n${restored.map((file) => `- ${file}`).join('\n')}`);
      return;
    }
    if (!hasFlag(args, '--regression')) throw new Error('prove requires --regression (or --restore). See `senior --help`.');
    const test = valueAfter(args, '--test');
    if (!test) throw new Error('prove --regression requires --test "<command that runs the regression test>"');
    const timeout = valueAfter(args, '--timeout');
    const timeoutSeconds = timeout === undefined ? undefined : Number(timeout);
    if (timeoutSeconds !== undefined && (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)) throw new Error('--timeout must be a positive number of seconds');
    const base = valueAfter(args, '--base');
    const expectFailure = valueAfter(args, '--expect-failure');
    const fix = valuesAfter(args, '--fix');

    const report = proveRegression(root, {
      test,
      ...(base === undefined ? {} : { base }),
      ...(expectFailure === undefined ? {} : { expectFailure }),
      ...(fix.length ? { fix } : {}),
      ...(timeoutSeconds === undefined ? {} : { timeoutMs: timeoutSeconds * 1000 }),
      ...(json ? {} : { onPhase: (phase: ProofPhase) => console.error(`running ${PHASE_LABEL[phase].trim()}…`) })
    });
    console.log(json ? JSON.stringify(report, null, 2) : formatRegression(report));
    process.exitCode = report.verdict === 'proven' ? 0 : report.reason === 'interrupted' ? 130 : 1;
    return;
  }

  if (command === 'doctor') {
    const result = await doctor(root);
    console.log(json ? JSON.stringify(result, null, 2) : [
      `Node: ${result.node}`,
      `Git repository: ${result.gitRepository ? 'yes' : 'no'}`,
      `SeniorOS state: ${result.seniorState ? 'yes' : 'no'}`,
      `Config: ${result.config}`,
      `Skills: claude=${result.hostSkills.claude ? 'yes' : 'no'} codex=${result.hostSkills.codex ? 'yes' : 'no'} generic=${result.hostSkills.generic ? 'yes' : 'no'}`,
      formatStack(result.stack)
    ].join('\n'));
    return;
  }

  if (command === 'install') {
    const target = valueAfter(args, '--target') as InstallTarget | undefined;
    const scope = (valueAfter(args, '--scope') ?? 'project') as InstallScope;
    const force = hasFlag(args, '--force');
    if (!target || !['claude', 'codex', 'generic'].includes(target)) throw new Error('install requires --target claude|codex|generic');
    if (!['project', 'user'].includes(scope)) throw new Error('--scope must be project or user');
    const installed = await installSkills(root, target, scope, force);
    console.log(`Installed ${installed.length} skills for ${target} (${scope}).`);
    for (const item of installed) console.log(`- ${item}`);
    const legacy = await findLegacySkills(destinationFor(root, target, scope));
    if (legacy.length) {
      console.warn('\nWarning: SeniorOS 0.1 skills without the `senior-` prefix are still installed and would trigger twice.');
      console.warn('They were not removed. Delete them when ready:');
      for (const item of legacy) console.warn(`- ${item}`);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function formatStack(stack: Awaited<ReturnType<typeof detectStack>>): string {
  return [
    `Root: ${stack.root}`,
    `Language: ${stack.language.join(', ') || 'unknown'}`,
    `Frameworks: ${stack.frameworks.join(', ') || 'none detected'}`,
    `Package manager: ${stack.packageManager ?? 'none detected'}`,
    `Database: ${stack.database.join(', ') || 'none detected'}`,
    `Auth: ${stack.auth.join(', ') || 'none detected'}`,
    `Deployment: ${stack.deployment.join(', ') || 'none detected'}`,
    `Tests: ${stack.testFrameworks.join(', ') || 'none detected'}`
  ].join('\n');
}

function formatScope(scope: ChangeScope): string {
  return scope.mode === 'base'
    ? `changes since ${scope.base} (merge-base ${scope.mergeBase.slice(0, 7)}), including uncommitted work`
    : 'uncommitted working tree';
}

function formatRisk(report: ReturnType<typeof assessRisk>, scope: ChangeScope): string {
  const lines = [`Risk: ${report.level.toUpperCase()} (${report.score})`, `Scope: ${formatScope(scope)}`, `Changed files: ${report.files.length}`];
  if (report.files.length === 0 && scope.mode === 'working-tree') {
    lines.push('No uncommitted changes. To assess a branch or PR, run: senior risk --base main');
  }
  for (const signal of report.signals) lines.push(`- +${signal.points} ${signal.code}: ${signal.reason}`);
  lines.push('Gates:');
  for (const gate of report.gates) lines.push(`- ${gate}`);
  return lines.join('\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SeniorOS error: ${message}`);
  process.exitCode = 1;
});
