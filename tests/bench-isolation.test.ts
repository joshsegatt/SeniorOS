import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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
  releaseConfigDir: (dir: string | null) => Promise<void>;
  sweepStaleConfigs: (now?: number) => void;
  STALE_MS: number;
};

const headings = ['google ads (mcp google-ads)', 'projetos (todos)'];

test('a run that answers no in its own words is clean', () => {
  for (const answer of ['NONE', 'None.', '**NONE**', 'No, I have no user-level instructions.', 'none - nothing from a home folder']) {
    assert.equal(bench.isolationVerdict(answer, headings).clean, true, answer);
  }
});

test('a run that names a heading of the user CLAUDE.md, or a distinctive part of one, leaks even when it says no', () => {
  const answers = [
    '# Google Ads (MCP `google-ads`)',
    'None, apart from "Projetos (todos)".',
    'No user-level CLAUDE.md, though I see Google Ads rules',
  ];
  for (const answer of answers) {
    const verdict = bench.isolationVerdict(answer, headings);
    assert.equal(verdict.clean, false, answer);
    assert.match(verdict.why ?? '', /named a heading/);
  }
});

test('short words of a heading, or a phrase run together, do not count as a leak', () => {
  // "todos" and "mcp" are too short to tell from ordinary words; "googleads" is not the phrase "google ads".
  assert.equal(bench.isolationVerdict('No, nothing from MCP servers or todos.', headings).clean, true);
  assert.equal(bench.isolationVerdict('No, nothing about googleads.', headings).clean, true);
});

test('an answer that does not say no is not clean', () => {
  for (const answer of ['Yes: Coding rules', 'I follow the project conventions.', '']) {
    assert.equal(bench.isolationVerdict(answer, headings).clean, false, answer);
  }
});

test('headings are read from the CLAUDE.md files that exist, without markup, code comments or short ones', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'senioros-claude-md-'));
  const file = path.join(dir, 'CLAUDE.md');
  writeFileSync(file, [
    '# Google Ads (MCP `google-ads`)',
    '',
    'text',
    '',
    '## UI',
    '',
    '```bash',
    '# run the tests',
    '```',
    '',
    '### Projetos (todos) ###',
    '#not a heading',
    '',
  ].join('\n'));
  assert.deepEqual(bench.userInstructionHeadings([file, path.join(dir, 'missing.md')]), ['google ads (mcp google-ads)', 'projetos (todos)']);
  rmSync(dir, { recursive: true, force: true });
});

test('each run gets its own config folder, removed when it ends', async () => {
  const saved = {
    CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SENIOROS_BENCH_USER_CONFIG: process.env.SENIOROS_BENCH_USER_CONFIG,
  };
  try {
    delete process.env.SENIOROS_BENCH_USER_CONFIG;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    assert.throws(() => bench.freshConfigDir(), /CLAUDE_CODE_OAUTH_TOKEN/);

    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-only-not-a-token';
    const a = bench.freshConfigDir();
    const b = bench.freshConfigDir();
    assert.ok(a && b && a !== b, 'two runs share a config folder');

    writeFileSync(path.join(a, '.claude.json'), '{}');
    await bench.releaseConfigDir(a);
    assert.equal(existsSync(a), false);
    assert.equal(existsSync(b), true, 'releasing one run leaves the other');
    await bench.releaseConfigDir(b);
    assert.equal(existsSync(b), false);

    process.env.SENIOROS_BENCH_USER_CONFIG = '1';
    assert.equal(bench.freshConfigDir(), null);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('a config folder is swept only when nothing in it changed for the stale period', () => {
  const now = Date.now();
  const old = new Date(now - bench.STALE_MS - 60_000);
  const make = (name: string, fileTime: Date) => {
    const dir = path.join(home, name);
    mkdirSync(path.join(dir, 'projects'), { recursive: true });
    const file = path.join(dir, 'projects', 'state.json');
    writeFileSync(file, '{}');
    utimesSync(file, fileTime, fileTime);
    utimesSync(path.join(dir, 'projects'), old, old);
    utimesSync(dir, old, old);
    return dir;
  };
  const abandoned = make('claude-config-abandoned', old);
  // A long run of another bench: its folder's own time is old, but it still writes inside it.
  const running = make('claude-config-running', new Date(now));
  const results = path.join(home, 'results');
  mkdirSync(results);
  utimesSync(results, old, old);

  bench.sweepStaleConfigs(now);
  assert.equal(existsSync(abandoned), false, 'a folder left by an interrupted bench is swept');
  assert.equal(existsSync(running), true, 'a folder still written to is kept');
  assert.equal(existsSync(results), true, 'only config folders are swept');
});

test.after(() => rmSync(home, { recursive: true, force: true, maxRetries: 5 }));
