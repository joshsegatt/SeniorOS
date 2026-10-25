import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { globToRegExp } from './config.js';
import { getChangeSet, getRepositoryRoot, operationInProgress, readFileAtRevision, resolveCommit, type ChangedFile } from './git.js';

/** Paths treated as tests: they stay in place while the fix is reverted. */
export const DEFAULT_TEST_PATTERNS = [
  '**/test/**', '**/tests/**', '**/__tests__/**', '**/spec/**', '**/specs/**', '**/e2e/**',
  '**/__snapshots__/**', '**/fixtures/**', '**/testdata/**',
  '**/*.test.*', '**/*.spec.*', '**/*_test.*', '**/*_spec.*', '**/test_*.py',
  '**/*Test.java', '**/*Tests.java', '**/*Test.kt', '**/*Test.cs', '**/*Tests.cs'
];

const RUNTIME_DIR = '.senior/runtime';
const ACTIVE_DIR = `${RUNTIME_DIR}/prove/active`;
const OUTPUT_TAIL_LINES = 40;

export type ProofPhase = 'with-fix' | 'without-fix' | 'restored';

export interface ProofRun {
  phase: ProofPhase;
  exitCode: number | null;
  passed: boolean;
  timedOut: boolean;
  durationMs: number;
  outputTail: string;
}

export type RegressionReason =
  | 'proven'
  | 'fix-fails-test'
  | 'test-misses-bug'
  | 'failed-for-other-reason'
  | 'unstable'
  | 'interrupted';

export interface RegressionReport {
  verdict: 'proven' | 'not-proven';
  reason: RegressionReason;
  message: string;
  testCommand: string;
  scope: 'working-tree' | 'base';
  base?: string;
  revision: string;
  fixFiles: string[];
  testFiles: string[];
  expectFailure?: string;
  runs: ProofRun[];
  restored: { files: number; verified: boolean };
  evidencePath?: string;
}

export interface RegressionOptions {
  /** Shell command that runs the regression test; exit code 0 means pass. */
  test: string;
  /** Compare against the merge-base with this ref instead of HEAD (for committed branch work). */
  base?: string;
  /** Globs or paths that select the fix explicitly, instead of "every changed non-test file". */
  fix?: string[];
  /** The run without the fix must fail AND its output must match this regular expression. */
  expectFailure?: string;
  /** Per-run timeout. Defaults to 10 minutes. */
  timeoutMs?: number;
  /** Called before each run, for progress output. */
  onPhase?: (phase: ProofPhase) => void;
}

export class ProofError extends Error {
  override name = 'ProofError';
}

interface BackupEntry {
  path: string;
  existed: boolean;
  sha256?: string;
  mode?: number;
  blob?: string;
}

interface BackupManifest {
  schemaVersion: 1;
  createdAt: string;
  testCommand: string;
  entries: BackupEntry[];
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function isTestPath(file: string): boolean {
  return DEFAULT_TEST_PATTERNS.some((pattern) => globToRegExp(pattern).test(file));
}

function matchesAny(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => pattern === file || globToRegExp(pattern).test(file));
}

function runTest(command: string, cwd: string, phase: ProofPhase, timeoutMs: number): ProofRun {
  const started = Date.now();
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const durationMs = Date.now() - started;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r\n/g, '\n').trimEnd();
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
  const exitCode = result.status;
  return {
    phase,
    exitCode,
    passed: exitCode === 0 && !timedOut,
    timedOut,
    durationMs,
    outputTail: output.split('\n').slice(-OUTPUT_TAIL_LINES).join('\n')
  };
}

function ensureRuntimeIgnored(top: string): void {
  const dir = path.join(top, RUNTIME_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  // A "*" .gitignore inside the runtime dir ignores the dir's contents, itself included, without touching tracked files.
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
}

function activeDir(top: string): string {
  return path.join(top, ACTIVE_DIR);
}

/** True when an earlier proof was interrupted before it could restore the working tree. */
export function hasInterruptedProof(cwd: string): boolean {
  return existsSync(path.join(activeDir(getRepositoryRoot(cwd)), 'manifest.json'));
}

function backup(top: string, paths: string[], testCommand: string): BackupManifest {
  const dir = activeDir(top);
  mkdirSync(path.join(dir, 'files'), { recursive: true });
  const entries: BackupEntry[] = paths.map((file, index) => {
    const absolute = path.join(top, file);
    if (!existsSync(absolute)) return { path: file, existed: false };
    const data = readFileSync(absolute);
    const blob = `files/${index}`;
    writeFileSync(path.join(dir, blob), data);
    return { path: file, existed: true, sha256: sha256(data), mode: statSync(absolute).mode, blob };
  });
  const manifest: BackupManifest = { schemaVersion: 1, createdAt: new Date().toISOString(), testCommand, entries };
  // The manifest is written last: its presence means "the working tree may be modified; restore from here".
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function restoreFromManifest(top: string, manifest: BackupManifest): { files: number; verified: boolean; problems: string[] } {
  const dir = activeDir(top);
  const problems: string[] = [];
  for (const entry of manifest.entries) {
    const absolute = path.join(top, entry.path);
    try {
      if (entry.existed && entry.blob) {
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, readFileSync(path.join(dir, entry.blob)));
        if (entry.mode !== undefined) chmodSync(absolute, entry.mode);
      } else if (existsSync(absolute)) {
        unlinkSync(absolute);
      }
    } catch (error) {
      problems.push(`${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const entry of manifest.entries) {
    const absolute = path.join(top, entry.path);
    if (entry.existed) {
      if (!existsSync(absolute) || sha256(readFileSync(absolute)) !== entry.sha256) problems.push(`${entry.path}: content does not match the backup`);
    } else if (existsSync(absolute)) {
      problems.push(`${entry.path}: should not exist after restore`);
    }
  }
  const verified = problems.length === 0;
  if (verified) rmSync(dir, { recursive: true, force: true });
  return { files: manifest.entries.length, verified, problems };
}

/** Restores the working tree after an interrupted proof. Returns the restored paths. */
export function restoreInterruptedProof(cwd: string): string[] {
  const top = getRepositoryRoot(cwd);
  const file = path.join(activeDir(top), 'manifest.json');
  if (!existsSync(file)) throw new ProofError('There is no interrupted proof to restore.');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as BackupManifest;
  const result = restoreFromManifest(top, manifest);
  if (!result.verified) {
    throw new ProofError(`Restore could not be verified; the backup was kept in ${ACTIVE_DIR}:\n- ${result.problems.join('\n- ')}`);
  }
  return manifest.entries.map((entry) => entry.path);
}

function selectFiles(changed: ChangedFile[], fix: string[] | undefined): { fixFiles: ChangedFile[]; testFiles: string[] } {
  const candidates = changed.filter((file) => !file.path.startsWith('.senior/'));
  if (fix && fix.length > 0) {
    const fixFiles = candidates.filter((file) => matchesAny(file.path, fix));
    const unmatched = fix.filter((pattern) => !candidates.some((file) => matchesAny(file.path, [pattern])));
    if (unmatched.length) throw new ProofError(`--fix matches no changed file: ${unmatched.join(', ')}`);
    return { fixFiles, testFiles: candidates.filter((file) => !fixFiles.includes(file)).map((file) => file.path) };
  }
  return {
    fixFiles: candidates.filter((file) => !isTestPath(file.path)),
    testFiles: candidates.filter((file) => isTestPath(file.path)).map((file) => file.path)
  };
}

function evidenceFile(top: string, report: RegressionReport): string {
  ensureRuntimeIgnored(top);
  const dir = path.join(top, RUNTIME_DIR, 'evidence');
  mkdirSync(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-regression.json`;
  writeFileSync(path.join(dir, name), JSON.stringify(report, null, 2));
  return `${RUNTIME_DIR}/evidence/${name}`;
}

/**
 * Proves that a regression test catches the bug a change fixes:
 * 1. with the fix, the test passes;
 * 2. with the fix temporarily reverted, the test fails (optionally with output matching `expectFailure`);
 * 3. with the fix restored, the test passes again.
 *
 * Only fix files are reverted; tests stay in place. Every touched file is backed up first and restored
 * byte-for-byte (verified by sha256), including on errors and Ctrl+C. A hard kill leaves a backup that
 * `restoreInterruptedProof` puts back.
 */
export function proveRegression(cwd: string, options: RegressionOptions): RegressionReport {
  const testCommand = options.test.trim();
  if (!testCommand) throw new ProofError('--test requires a command that runs the regression test.');
  let failurePattern: RegExp | undefined;
  if (options.expectFailure !== undefined) {
    try {
      failurePattern = new RegExp(options.expectFailure, 'm');
    } catch (error) {
      throw new ProofError(`--expect-failure is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

  const top = getRepositoryRoot(cwd);
  const busy = operationInProgress(top);
  if (busy) throw new ProofError(`A ${busy} is in progress; finish it before proving.`);
  if (existsSync(path.join(activeDir(top), 'manifest.json'))) {
    throw new ProofError('A previous proof was interrupted and the working tree may still be modified. Run `senior prove --restore` first.');
  }

  const changeSet = getChangeSet(cwd, options.base === undefined ? {} : { base: options.base });
  const revision = changeSet.scope.mode === 'base' ? changeSet.scope.mergeBase : resolveCommit(top, 'HEAD');
  const { fixFiles, testFiles } = selectFiles(changeSet.files, options.fix);
  if (fixFiles.length === 0) {
    throw new ProofError(
      changeSet.files.length === 0
        ? `No changes relative to ${changeSet.scope.mode === 'base' ? changeSet.scope.base : 'HEAD'}. Commit the fix on a branch and use --base, or prove before committing.`
        : 'Every changed file looks like a test, so there is no fix to revert. Select the fix with --fix <path>.'
    );
  }

  const touched = [...new Set(fixFiles.flatMap((file) => (file.from ? [file.path, file.from] : [file.path])))];
  const withoutFix = new Map(touched.map((file) => [file, readFileAtRevision(top, revision, file)] as const));

  const report: RegressionReport = {
    verdict: 'not-proven',
    reason: 'fix-fails-test',
    message: '',
    testCommand,
    scope: changeSet.scope.mode,
    revision,
    fixFiles: fixFiles.map((file) => file.path),
    testFiles,
    runs: [],
    restored: { files: 0, verified: true }
  };
  if (changeSet.scope.mode === 'base') report.base = changeSet.scope.base;
  if (options.expectFailure !== undefined) report.expectFailure = options.expectFailure;

  const finish = (reason: RegressionReason, message: string): RegressionReport => {
    report.reason = reason;
    report.verdict = reason === 'proven' ? 'proven' : 'not-proven';
    report.message = message;
    report.evidencePath = evidenceFile(top, report);
    return report;
  };

  options.onPhase?.('with-fix');
  const first = runTest(testCommand, cwd, 'with-fix', timeoutMs);
  report.runs.push(first);
  if (!first.passed) {
    return finish('fix-fails-test', first.timedOut ? 'The test timed out with the fix applied.' : 'The test fails with the fix applied, so there is nothing to prove yet.');
  }

  // From here on the working tree is modified; it is restored in `finally`, whatever happens.
  ensureRuntimeIgnored(top);
  const manifest = backup(top, touched, testCommand);
  let interrupted = false;
  const onSignal = () => {
    interrupted = true;
  };
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'];
  for (const signal of signals) process.on(signal, onSignal);

  let second: ProofRun;
  try {
    for (const [file, content] of withoutFix) {
      const absolute = path.join(top, file);
      if (content === null) {
        if (existsSync(absolute)) unlinkSync(absolute);
      } else {
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, content);
      }
    }
    options.onPhase?.('without-fix');
    second = runTest(testCommand, cwd, 'without-fix', timeoutMs);
    report.runs.push(second);
  } finally {
    const restored = restoreFromManifest(top, manifest);
    report.restored = { files: restored.files, verified: restored.verified };
    for (const signal of signals) process.off(signal, onSignal);
    if (!restored.verified) {
      throw new ProofError(`DANGER: the working tree could not be verified after restoring. The backup was kept in ${ACTIVE_DIR}; run \`senior prove --restore\`.\n- ${restored.problems.join('\n- ')}`);
    }
  }

  if (interrupted) return finish('interrupted', 'Interrupted. The working tree was restored and verified.');

  options.onPhase?.('restored');
  const third = runTest(testCommand, cwd, 'restored', timeoutMs);
  report.runs.push(third);

  if (second.passed) return finish('test-misses-bug', 'The test also passes without the fix, so it does not catch the bug.');
  if (second.timedOut) return finish('failed-for-other-reason', 'Without the fix the test timed out instead of failing.');
  if (failurePattern && !failurePattern.test(second.outputTail)) {
    return finish('failed-for-other-reason', `Without the fix the test failed, but its output does not match --expect-failure /${options.expectFailure}/.`);
  }
  if (!third.passed) return finish('unstable', 'The test passed, failed without the fix, then failed again with the fix restored. It may be flaky.');
  return finish('proven', 'The test passes with the fix, fails without it, and passes again after restoring it.');
}
