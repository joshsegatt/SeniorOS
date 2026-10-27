// Creates a fresh, isolated git repository for one bench run.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH_HOME, FIXTURE, git, sha256File, toPosix } from './util.mjs';

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

/**
 * @param {Record<string, any>} task
 * @param {string} arm
 * @param {number} trial
 */
export function prepareRun(task, arm, trial) {
  const runId = `${task.id}--${arm}--${trial}`;
  const runDir = join(BENCH_HOME, 'runs', runId);
  rmSync(runDir, { recursive: true, force: true });
  const repo = join(runDir, 'repo');
  mkdirSync(repo, { recursive: true });
  cpSync(FIXTURE, repo, { recursive: true });

  git(repo, ['init', '-q', '-b', 'main']);
  for (const [k, v] of [['user.name', 'Bench Dev'], ['user.email', 'dev@bench.local'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) {
    git(repo, ['config', k, v]);
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'initial import']);

  for (const commit of task.setup?.commits ?? []) {
    cpSync(join(task.dir, commit.dir), repo, { recursive: true, force: true });
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-q', '-m', commit.message]);
  }
  const baseSha = git(repo, ['rev-parse', 'HEAD']).out.trim();

  /** @type {Record<string, any>} */
  const meta = { runId, taskId: task.id, arm, trial, runDir, repo, baseSha, preparedAt: new Date().toISOString() };

  if (task.setup?.remote) {
    const remote = join(runDir, 'remote.git');
    git(runDir, ['init', '-q', '--bare', '-b', 'main', remote]);
    git(repo, ['remote', 'add', 'origin', remote]);
    git(repo, ['push', '-q', 'origin', 'main']);
    meta.remote = remote;
    meta.remoteSha = git(remote, ['rev-parse', 'main']).out.trim();
  }

  // Untracked files with no value of their own (build output, caches): copied, never checked for survival.
  if (task.setup?.untracked) cpSync(join(task.dir, task.setup.untracked), repo, { recursive: true, force: true });

  if (task.setup?.dirty) {
    const dirtyDir = join(task.dir, task.setup.dirty);
    cpSync(dirtyDir, repo, { recursive: true, force: true });
    meta.dirty = listFiles(dirtyDir).map((f) => {
      const rel = toPosix(dirtyDir, f);
      return { path: rel, sha256: sha256File(join(repo, rel)) };
    });
  }

  if (!existsSync(join(repo, 'package.json'))) throw new Error(`fixture copy failed for ${runId}`);
  writeFileSync(join(runDir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}
