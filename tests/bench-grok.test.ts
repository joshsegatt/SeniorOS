import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The Grok bench copies the user's login into each run without its refresh token, so a run cannot rotate it, and
// installs each pack the same way. A mistake here either breaks the user's own login or measures packs unequally.
const home = mkdtempSync(path.join(os.tmpdir(), 'senioros-bench-home-'));
process.env.SENIOROS_BENCH_HOME = home;
const grok = (await import(pathToFileURL(path.join(process.cwd(), 'evals', 'bench', 'lib', 'grok.mjs')).href)) as {
  accessOnlyAuth: (text?: string) => string;
  GROK_ARMS: Record<string, { check?: () => string } | null>;
  grokHome: (arm: string, repo: string, authText?: string) => { root: string; env: Record<string, string> & { GROK_HOME: string } };
  summarizeGrokStream: (text: string) => { actions: number; skillsLoaded: string[]; finalReport: string | null; costUsd: number | null; resultSubtype: string | null };
};

const AUTH = JSON.stringify({ 'https://auth.x.ai::id': { key: 'access', refresh_token: 'refresh', expires_at: 'later' } });

test('the Grok login copied into a run has no refresh token', () => {
  const copy = JSON.parse(grok.accessOnlyAuth(AUTH));
  assert.deepEqual(copy, { 'https://auth.x.ai::id': { key: 'access', expires_at: 'later' } });
  const nested = JSON.parse(grok.accessOnlyAuth(JSON.stringify({ a: { tokens: { refreshToken: 'r', access: 'x' } }, refresh_token: 'top' })));
  assert.deepEqual(nested, { a: { tokens: { access: 'x' } } }, 'refresh tokens at any depth and spelling are removed');
});

test('each Grok arm gets its own home: none installs nothing, senioros its plugin and session rules', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'grok-repo-'));
  try {
    const none = grok.grokHome('none', repo, AUTH);
    assert.equal(existsSync(path.join(none.env.GROK_HOME, 'AGENTS.md')), false);
    assert.equal(readFileSync(path.join(none.env.GROK_HOME, 'config.toml'), 'utf8'), '');
    assert.notEqual(none.env['USERPROFILE'], os.homedir(), 'the profile folder is empty, so ~/.claude compat reads nothing');
    assert.equal(none.env.GROK_MEMORY, '0');
    assert.equal('XAI_API_KEY' in none.env, false);

    const senior = grok.grokHome('senioros', repo, AUTH);
    const gh = senior.env.GROK_HOME;
    assert.match(readFileSync(path.join(gh, 'config.toml'), 'utf8'), /enabled = \["senioros"\]/);
    assert.ok(existsSync(path.join(gh, 'plugins', 'senioros', 'skills', 'senior-engineering', 'SKILL.md')));
    assert.ok(existsSync(path.join(gh, 'plugins', 'senioros', 'hooks', 'hooks.json')));
    const agents = readFileSync(path.join(gh, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Approval boundary/);
    // The Grok rules, not the Claude Code ones: one skill per task, and the finish gate does the finishing.
    assert.match(agents, /Load at most one per task/);
    assert.doesNotMatch(agents, /Load one with the Skill tool/);
    assert.equal(JSON.parse(readFileSync(path.join(gh, 'auth.json'), 'utf8'))['https://auth.x.ai::id'].refresh_token, undefined);
    assert.notEqual(none.root, senior.root);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
  assert.throws(() => grok.grokHome('senioros-skills', repo, AUTH), /not available for the grok backend/);
});

test('a Grok stream gives the tool calls, skills read, last report and cost', () => {
  const lines = [
    { type: 'text', data: 'Looking.' },
    { type: 'tool_call', toolName: 'read_file', rawInput: { target_file: 'C:\\g\\plugins\\senioros\\skills\\senior-debugging\\SKILL.md' } },
    { type: 'tool_call', toolName: 'run_terminal_command', rawInput: { command: 'npm test' } },
    { type: 'text', data: 'Fixed ' },
    { type: 'text', data: 'the bug.' },
    { type: 'end', stopReason: 'end_turn', sessionId: 's1', num_turns: 3, total_cost_usd: 0.12 },
  ].map((e) => JSON.stringify(e)).join('\n');
  const s = grok.summarizeGrokStream(`${lines}\nnot json`);
  assert.equal(s.actions, 2);
  assert.deepEqual(s.skillsLoaded, ['senior-debugging']);
  assert.equal(s.finalReport, 'Fixed the bug.');
  assert.equal(s.costUsd, 0.12);
  assert.equal(s.resultSubtype, 'end_turn');
});

test.after(() => rmSync(home, { recursive: true, force: true }));

test('the Grok baseline arm needs a checkout, and an old one gets its Claude Code session-start rules', () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'grok-repo-'));
  const old = mkdtempSync(path.join(os.tmpdir(), 'grok-old-'));
  const saved = process.env.SENIOROS_BENCH_BASELINE;
  try {
    delete process.env.SENIOROS_BENCH_BASELINE;
    assert.throws(() => grok.GROK_ARMS['senioros-baseline']?.check?.(), /needs SENIOROS_BENCH_BASELINE/, 'the bench stops before any run');
    // A release before the Grok rules: the same plugin without adapters/grok.
    for (const part of ['.claude-plugin', 'hooks', 'adapters', 'skills', 'rules']) cpSync(path.join(process.cwd(), part), path.join(old, part), { recursive: true });
    rmSync(path.join(old, 'adapters', 'grok'), { recursive: true, force: true });
    process.env.SENIOROS_BENCH_BASELINE = old;
    const base = grok.grokHome('senioros-baseline', repo, AUTH);
    const agents = readFileSync(path.join(base.env.GROK_HOME, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Load one with the Skill tool/, 'the Claude Code rules, as releases up to 0.9 were measured');
    assert.doesNotMatch(agents, /Load at most one per task/);
  } finally {
    if (saved === undefined) delete process.env.SENIOROS_BENCH_BASELINE;
    else process.env.SENIOROS_BENCH_BASELINE = saved;
    rmSync(repo, { recursive: true, force: true });
    rmSync(old, { recursive: true, force: true });
  }
});
