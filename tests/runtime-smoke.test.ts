import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getChangedFiles } from '../src/core/git.js';
import { assessRisk } from '../src/core/risk-engine.js';
import { installSkills } from '../src/core/install.js';

test('git discovery expands nested untracked files so risk signals are not hidden', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-risk-'));
  await mkdir(path.join(root, 'src', 'auth'), { recursive: true });
  await mkdir(path.join(root, 'migrations'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), 'baseline\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'SeniorOS Test'], { cwd: root });
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: root });
  await writeFile(path.join(root, 'src', 'auth', 'session.ts'), 'export const x = 1;\n');
  await writeFile(path.join(root, 'migrations', '001.sql'), 'select 1;\n');

  const files = getChangedFiles(root);
  assert.ok(files.some((file) => file.path === 'src/auth/session.ts'));
  assert.ok(files.some((file) => file.path === 'migrations/001.sql'));
  const report = assessRisk(files);
  assert.equal(report.level, 'high');
});

test('skill installer copies the portable skill set into a project host directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'senior-install-'));
  const installed = await installSkills(root, 'claude', 'project', false);
  assert.ok(installed.length >= 6);
  const manifest = await readFile(path.join(root, '.claude', 'skills', 'senior-engineering', 'SKILL.md'), 'utf8');
  assert.match(manifest, /name: senior-engineering/);
});
