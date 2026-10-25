import { execFileSync } from 'node:child_process';

export interface ChangedFile {
  status: string;
  /** Path relative to the repository root, always with forward slashes. */
  path: string;
}

export type ChangeScope =
  | { mode: 'working-tree' }
  | { mode: 'base'; base: string; mergeBase: string };

export interface ChangeSet {
  scope: ChangeScope;
  files: ChangedFile[];
}

export interface ChangedFilesOptions {
  /** Compare against the merge-base with this ref (branch/PR review) instead of only uncommitted work. */
  base?: string;
}

export class GitError extends Error {
  override name = 'GitError';
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new GitError('git is not installed or not on PATH.');
    }
    const stderr = String((error as { stderr?: unknown }).stderr ?? '').trim();
    throw new GitError(`git ${args[0]} failed${stderr ? `: ${stderr}` : ''}`);
  }
}

function repositoryRoot(cwd: string): string {
  try {
    return runGit(cwd, ['rev-parse', '--show-toplevel']).trim();
  } catch (error) {
    if (error instanceof GitError && /not a git repository/i.test(error.message)) {
      throw new GitError('Not a git repository. Run `senior risk` inside a git working tree.');
    }
    throw error;
  }
}

/** Parses `git status --porcelain=v1 -z`. Renames/copies are `XY new\0old\0`. */
export function parseStatusZ(output: string): ChangedFile[] {
  const tokens = output.split('\0');
  const files: ChangedFile[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const entry = tokens[i];
    if (!entry || entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    files.push({ status: xy.trim() || 'M', path: entry.slice(3) });
    if (xy.includes('R') || xy.includes('C')) i += 1;
  }
  return files;
}

/** Parses `git diff --name-status -z`. Renames/copies are `R100\0old\0new\0`. */
export function parseNameStatusZ(output: string): ChangedFile[] {
  const tokens = output.split('\0');
  const files: ChangedFile[] = [];
  let i = 0;
  while (i < tokens.length) {
    const status = tokens[i];
    if (!status) break;
    const letter = status.charAt(0);
    if (letter === 'R' || letter === 'C') {
      const target = tokens[i + 2];
      if (target) files.push({ status: letter, path: target });
      i += 3;
    } else {
      const target = tokens[i + 1];
      if (target) files.push({ status: letter, path: target });
      i += 2;
    }
  }
  return files;
}

function mergeByPath(...groups: ChangedFile[][]): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>();
  for (const group of groups) for (const file of group) byPath.set(file.path, file);
  return [...byPath.values()];
}

/**
 * Lists changed files for risk assessment.
 *
 * - default: uncommitted work (staged, unstaged and untracked);
 * - `base`: everything since the merge-base with `base`, including uncommitted work.
 *
 * Throws `GitError` instead of returning an empty list, so a broken git context is never reported as "low risk".
 */
export function getChangeSet(cwd: string, options: ChangedFilesOptions = {}): ChangeSet {
  const top = repositoryRoot(cwd);

  if (options.base === undefined) {
    const output = runGit(top, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    return { scope: { mode: 'working-tree' }, files: parseStatusZ(output) };
  }

  const base = options.base.trim();
  if (!base || base.startsWith('-')) throw new GitError(`Invalid base ref: "${options.base}".`);
  try {
    runGit(top, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  } catch {
    throw new GitError(`Base ref "${base}" does not exist. Try a branch such as main or origin/main.`);
  }

  const mergeBase = runGit(top, ['merge-base', base, 'HEAD']).trim();
  const tracked = parseNameStatusZ(runGit(top, ['diff', '--name-status', '-M', '-z', mergeBase]));
  const untracked = runGit(top, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ status: '??', path }));

  return { scope: { mode: 'base', base, mergeBase }, files: mergeByPath(tracked, untracked) };
}

/** Backwards-compatible helper: uncommitted changes only. */
export function getChangedFiles(cwd: string): ChangedFile[] {
  return getChangeSet(cwd).files;
}
