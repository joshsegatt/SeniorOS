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

const VERSION = '0.2.0';

function usage(): void {
  console.log(`SeniorOS ${VERSION}\n\nUsage:\n  senior init\n  senior inspect [--json]\n  senior risk [--base <ref>] [--json]\n  senior finish [--json]\n  senior doctor [--json]\n  senior install --target <claude|codex|generic> [--scope <project|user>] [--force]\n`);
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
