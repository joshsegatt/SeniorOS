import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hooksDir = path.join(process.cwd(), 'adapters', 'claude-code', 'hooks');
const { decide } = (await import(pathToFileURL(path.join(hooksDir, 'pretool-guard.mjs')).href)) as {
  decide: (raw: string) => { hookSpecificOutput: { permissionDecision: string } } | null;
};

const bash = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

test('Claude Code guard asks before destructive commands and stays silent otherwise', () => {
  for (const command of ['git push --force origin main', 'git reset --hard HEAD~1', 'git checkout -- .', 'rm -rf dist /home/u/project']) {
    assert.equal(decide(bash(command))?.hookSpecificOutput.permissionDecision, 'ask', command);
  }
  for (const command of ['git status', 'npm test', 'rm -rf node_modules']) assert.equal(decide(bash(command)), null, command);
  assert.equal(decide('not json'), null);
});

test('Claude Code guard runs as a hook without triggering the Antigravity guard it imports', () => {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'pretool-guard.mjs')], { input: bash('git status'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});

test('Claude Code session start injects the SeniorOS routing rules', () => {
  const r = spawnSync(process.execPath, [path.join(hooksDir, 'session-start.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /senior-engineering/);
  assert.match(out.hookSpecificOutput.additionalContext, /Approval boundary/);
});
