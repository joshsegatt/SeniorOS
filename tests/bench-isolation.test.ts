import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The Claude bench keeps the user's own configuration out of the runs. These helpers decide whether it did, so a
// mistake here either measures the user's CLAUDE.md as if it were a pack, or refuses to start for no reason.
const home = mkdtempSync(path.join(os.tmpdir(), 'senioros-bench-home-'));
process.env.SENIOROS_BENCH_HOME = home;
const claudeUrl = pathToFileURL(path.join(process.cwd(), 'evals', 'bench', 'lib', 'claude.mjs')).href;
const bench = (await import(claudeUrl)) as {
  isolationVerdict: (answer: string, headings: string[]) => { clean: boolean; why?: string };
  userInstructionHeadings: (files: string[]) => string[];
  freshConfigDir: () => string | null;
  releaseConfigDir: (dir: string | null) => void;
  removeDir: (dir: string, attempts?: number) => boolean;
};

const headings = ['google ads (mcp google-ads)', 'projetos (todos)'];

test('a run that answers no in its own words is clean', () => {
  for (const answer of ['NONE', 'None.', '**NONE**', 'No, I have no user-level instructions.', 'none - nothing from a home folder']) {
    assert.equal(bench.isolationVerdict(answer, headings).clean, true, answer);
  }
});

test('a run that quotes a heading of the user CLAUDE.md leaks, even when it also says none', () => {
  for (const answer of ['# Google Ads (MCP `google-ads`)', 'None, apart from "Projetos (todos)".']) {
    const verdict = bench.isolationVerdict(answer, headings);
    assert.equal(verdict.clean, false, answer);
    assert.match(verdict.why ?? '', /quoted a heading/);
  }
});

test('an answer that does not say no is not clean', () => {
  for (const answer of ['Yes: Coding rules', 'I follow the project conventions.', '']) {
    assert.equal(bench.isolationVerdict(answer, headings).clean, false, answer);
  }
});

test('headings are read from the CLAUDE.md files that exist, without markup or short ones', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'senioros-claude-md-'));
  const file = path.join(dir, 'CLAUDE.md');
  writeFileSync(file, '# Google Ads (MCP `google-ads`)\n\ntext\n\n## UI\n\n### Projetos (todos) ###\n#not a heading\n');
  assert.deepEqual(bench.userInstructionHeadings([file, path.join(dir, 'missing.md')]), ['google ads (mcp google-ads)', 'projetos (todos)']);
});

test('each run gets its own config folder, removed when it ends, and stale ones are swept', () => {
  const saved = { token: process.env.CLAUDE_CODE_OAUTH_TOKEN, user: process.env.SENIOROS_BENCH_USER_CONFIG };
  try {
    const stale = path.join(home, 'claude-config-stale');
    const recent = path.join(home, 'claude-config-recent');
    mkdirSync(path.join(stale, 'projects'), { recursive: true });
    mkdirSync(recent);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    utimesSync(stale, dayAgo, dayAgo);

    delete process.env.SENIOROS_BENCH_USER_CONFIG;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    assert.throws(() => bench.freshConfigDir(), /CLAUDE_CODE_OAUTH_TOKEN/);
    if (apiKey !== undefined) process.env.ANTHROPIC_API_KEY = apiKey;

    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-only-not-a-token';
    const a = bench.freshConfigDir();
    const b = bench.freshConfigDir();
    assert.ok(a && b && a !== b, 'two runs share a config folder');
    assert.equal(existsSync(stale), false, 'a folder left by an interrupted bench is swept');
    assert.equal(existsSync(recent), true, 'a folder of a bench still running is kept');

    writeFileSync(path.join(a, '.claude.json'), '{}');
    bench.releaseConfigDir(a);
    assert.equal(existsSync(a), false);
    assert.equal(existsSync(b), true, 'releasing one run leaves the other');
    bench.releaseConfigDir(b);

    process.env.SENIOROS_BENCH_USER_CONFIG = '1';
    assert.equal(bench.freshConfigDir(), null);
  } finally {
    if (saved.token === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = saved.token;
    if (saved.user === undefined) delete process.env.SENIOROS_BENCH_USER_CONFIG;
    else process.env.SENIOROS_BENCH_USER_CONFIG = saved.user;
  }
});

test('removeDir deletes a tree and treats a missing folder as removed', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'senioros-remove-'));
  mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
  writeFileSync(path.join(dir, 'a', 'b', 'f.txt'), 'x');
  assert.equal(bench.removeDir(dir), true);
  assert.equal(existsSync(dir), false);
  assert.equal(bench.removeDir(dir), true);
});

test.after(() => bench.removeDir(home));
