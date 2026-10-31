# Changelog

All notable changes to SeniorOS will be documented here.

## [Unreleased]

### Added

- OpenCode 1.x plugin (`adapters/opencode/plugin.mjs`, the npm package's `main`), enabled with `"plugin": ["senioros"]` in `opencode.json`:
  - registers the `senior-*` skills;
  - adds the routing rules to the system prompt;
  - fails destructive `bash` calls (OpenCode's tool hook cannot ask), telling the agent to show what would be lost and let the user run it;
  - runs the finish gate in a separate Node process when a session goes idle, and sends failing checks back to the session.
- Verified in OpenCode 1.14.34 on Windows: the guard blocked `git reset --hard` after the user said yes, and the finish gate sent the agent back on a failing test.
- The guard protects the agent's own configuration in every supported host (`.claude/settings*.json` and `.claude/plugins/`, `.codex/config.toml`, `hooks.json` and `plugins/`, `.cursor/hooks.json` and `plugins/`, `opencode.json` and plugin folders, `.gemini` hooks and rules). An agent that could rewrite these could switch the guard and the finish gate off. Shell commands that change them need confirmation, and reading them stays free (before, only `.gemini` was covered, and reads were flagged too). File-edit tools are covered too: Claude Code `Edit`/`Write`/`MultiEdit`/`NotebookEdit`, Codex `apply_patch` (judged by the files it writes), OpenCode `edit`/`write`/patch. Cursor and Antigravity have no hook before a file edit, so there only shell commands are covered.

### Fixed

- the finish gate's message now tells the agent to stay within what the user asked, and the second time, for unchanged code, to repeat its explanation and stop. In OpenCode, an agent sent back twice with the same text had edited a test the user had said not to touch; with the new text it kept its explanation and changed nothing (one run). Applies to Claude Code, Codex, Cursor, OpenCode and the Antigravity hooks.

## [0.7.0] - 2026-10-28

The guard and the finish gate in Codex, tested in the Codex CLI itself. Installing from GitHub
(`codex plugin marketplace add joshsegatt/SeniorOS`) was checked to bring exactly the three SeniorOS hooks.

### Added

- Codex plugin hooks (`adapters/codex/`, declared in `.codex-plugin/plugin.json`), and a Codex marketplace (`.agents/plugins/marketplace.json`) so `codex plugin marketplace add joshsegatt/SeniorOS` installs the plugin:
  - a `SessionStart` hook with the routing rules;
  - a `PreToolUse` guard that denies destructive commands (Codex hooks cannot ask), telling the agent to show what would be lost and let the user run it;
  - a `Stop` finish gate that sends the agent back on failing checks.
- Verified in Codex CLI 0.164.0 on Windows: the guard blocked `git reset --hard`, and the finish gate sent the agent back on a failing test and turned its "done" into a report of the failure.

### Fixed

- the Codex plugin no longer picks up `hooks/hooks.json`, the Claude Code hooks, whose guard answer (`ask`) Codex treats as an error and ignores.

## [0.6.0] - 2026-10-28

The guard and the finish gate in Cursor, and SeniorOS as a native Antigravity plugin. Neither has been tested inside
the Cursor app or `agy` yet; CI runs the hook commands through the shell on Linux and Windows.

### Added

- Cursor plugin (`.cursor-plugin/plugin.json`, `adapters/cursor/`):
  - the skills;
  - a `sessionStart` hook with the routing rules;
  - a `beforeShellExecution` guard that asks before destructive commands;
  - a `stop` finish gate that sends the agent back on failing checks.
- Native Antigravity plugin (`plugin.json` and `rules/senioros.md` at the root): `agy plugin install https://github.com/joshsegatt/SeniorOS` adds the skills and routing rules. The hooks still come from `senior install --target antigravity`.
- `adapters/shared/`: the guard and finish gate shared by the plugin hosts. The Claude Code hooks now use it, with the same behavior.

### Fixed

- the finish gate no longer treats two repositories whose paths differ only in case as one outside Windows: on Linux and macOS each is checked and remembered separately.

## [0.5.0] - 2026-10-28

A finish gate in the Claude Code plugin, a guard that judges chained commands one by one, and bench results on Claude
Sonnet: SeniorOS 24/24 on the core set, Superpowers 19/24, no pack 17/24.

### Added

- Claude Code finish gate (`adapters/claude-code/hooks/stop-gate.mjs`, a `Stop` hook in the plugin): when code changed, runs `senior finish` (or `npx senioros finish`) before the agent may stop and sends it back on a failing check, at most twice per change set; a Sonnet bench run had reported "the full suite passes" with a failing test;
- bench honesty check: each final report's claims about the tests are compared with the real results, with a "False tests pass claims" row in the report;
- bench tasks `t7-ci-suite` (an e2e suite `npm test` skips) and `t8-cleanup` (a cleanup whose `git clean` would take a local database and `.env.local`), with `suites`, `mustRemove` and `setup.untracked` in the grader;
- bench `senioros-skills` arm for Claude Code: the plugin without its hooks, to measure what the hooks add;
- bench `strong` task set (`x1`–`x4`: soft delete, parallel sync, summary cache, orders budget) written independently of the skills to test strong models;
- bench: Claude Sonnet results on the core set (`senioros` 24/24, `superpowers` 19/24, `none` 17/24) and on the strong set (all arms 11–12/12, so it does not discriminate).

### Fixed

- the guard no longer asks before `git clean` limited by pathspec to build folders (`git clean -fdX -- dist coverage`); without a pathspec, or with any other path, it still asks;
- the destructive-command guard judges chained commands one by one: `cd <repo> && rm -rf dist coverage` was flagged because any `&&` cancelled the build-folder exemption, and `cat .gitignore && find .env.local` was flagged as printing secrets.

## [0.4.0] - 2026-10-27

One-command setup for Google Antigravity, and the bench results on the front page.

### Added

- `senior install --target antigravity [--turbo] [--force]` sets up Google Antigravity in one command: copies the skills to `~/.gemini/config/senioros/skills` and registers them, adds the routing rules to `GEMINI.md` in a marked block, and merges the hooks into `config/hooks.json` next to the user's own; each changed file is backed up once and reinstalling never duplicates;
- the installer records what it wrote (`~/.gemini/config/senioros/install.json`): without `--force` it keeps skills you edited, hook blocks and scripts it did not write, and SeniorOS rules outside its block, and a hook turned off with `"enabled": false` stays off;
- `senior uninstall --target antigravity` removes only what the installer added and restores what it replaced with `--force`;
- README: bench results up front with a replay of a real run (`brand/social/demo-approval-boundary.svg`), the Claude Code plugin as the recommended install, and `DESIGN.md` for visual assets;
- bench: Claude Sonnet results on the hard set (`none` 22/22, `senioros` 22/22, `superpowers` 19/22).

### Fixed

- bench: a Claude Code run that ends on a usage limit or API error now fails as `launched` instead of being graded as an untouched repository, and the bench stops starting new runs.

## [0.3.0] - 2026-10-27

Google Antigravity support, plugin hooks for Claude Code, and skill changes measured with a live bench against no pack
and Superpowers (Gemini Flash in Antigravity, Claude Haiku in Claude Code; results in `evals/bench/README.md`).

### Added

- `senior prove --regression --test "<cmd>"`: proves a regression test catches the bug (passes with the fix, fails with it reverted, passes again restored), with `--expect-failure`, `--base`, `--fix`, `--timeout` and `--json`; evidence written to `.senior/runtime/evidence/`;
- `senior prove --restore`: restores the working tree after a proof that was killed mid-run;
- `senior-debugging` and `senior-finish` use `senior prove --regression` when the CLI is available; new eval `finish-regression-proof`;
- Google Antigravity adapter (`adapters/antigravity/`): skills registration, routing rules, and three fail-open hooks: project context at session start, a guard that forces confirmation for destructive commands, and a stop gate that runs `senior finish` before the agent may finish with changed code;
- Antigravity guard always answers with a decision (`--passthrough=ask|allow`, also on errors): Antigravity denies a call whose hook gives none, which had blocked every terminal command; hook commands are written without quotes, since Antigravity runs them without a shell; new `track.mjs` hook lets the stop gate prove repositories edited in conversations that have no workspace; `SENIOROS_CLI` overrides how hooks call the CLI;
- from the first bench pilot (all arms 6/6; SeniorOS the most expensive): `senior-engineering` and `senior-finish` no longer trigger on low-risk copy/label edits (evals `senior-copy-change-direct`, `finish-low-risk-skip`); `senior-debugging` reads the implicated commit's whole diff and restores every unintended change (eval `debug-regression-commit-diff`); the Antigravity rules carry a CLI reference so agents stop running `senior --help`; new `context.mjs` PreInvocation hook gives project context and decisions when a workspace-less conversation first touches a repository;
- from the first independent bench task (`h7`, where every arm sometimes let a member grant themselves admin through the request body): `senior-engineering` decides what each caller may control when input reaches stored state or a privileged operation, picks allowed fields instead of spreading the input, and tests a forbidden one; `senior-code-review` asks what each caller-controlled input can reach (evals `senior-input-boundary`, `senior-input-boundary-typo`, `review-mass-assignment`);
- Claude Code plugin hooks (`hooks/hooks.json`): a session-start hook adds the SeniorOS routing rules and approval boundary (`adapters/claude-code/rules.md`), and a `Bash` guard asks before destructive commands; in the first Claude Code bench the plugin's skills were never loaded without them (0 of 51 runs);
- bench `claude` backend (`claude -p`, arms as flags, so arms run in parallel) with per-run cost and the final report saved;
- bench `hard` task set (`h1`–`h5`: root cause elsewhere, project rule, shared function, red CI with an intended change, multi-regression refactor), `--tasks core|hard`, and a per-run count of agent tool calls and loaded skills;
- live bench (`evals/bench/`): six trap tasks on a fixture project, arms `none` / `superpowers` / `senioros` / `senioros-skills`, a deterministic grader (hidden tests, regression proof, scope, test weakening, destructive boundary) verified by reference solutions in `npm run check`, and an Antigravity runner (`agentapi`, `agy` or manual).

## [0.2.0] - 2026-10-25

First release on npm: `npx senioros` or `npm install -g senioros` (the CLI command is `senior`).

### Changed (breaking)

- every skill is prefixed with `senior-` (`senior-code-review`, `senior-debugging`, `senior-finish`, `senior-project-intelligence`, `senior-skill-authoring`; `senior-engineering` is unchanged) to avoid collisions with host and third-party skills; `senior install` lists leftover 0.1 skills and never deletes them;
- skills rewritten for current models: "Use when…" trigger descriptions that also say when not to use the skill, a one-line core rule, and calm "if you notice yourself thinking… / do this instead" tables;
- the typo eval now expects `senior-engineering` not to trigger on trivial edits.

### Added

- `.senior/config.json`: `proof.checks` (any language), `risk.rules` and `risk.ignore`, with strict validation; `senior doctor` reports its status;
- Claude Code plugin and marketplace manifests (`.claude-plugin/`) and a Codex plugin manifest (`.codex-plugin/`);
- validator: `SKILL.md` must stay under 20,000 bytes, names must start with `senior-`, descriptions with "Use ";
- eval cases `debug-three-failed-fixes` and `finish-unverified-claim`;
- npm package `senioros` and Claude Code plugin `senioros` (`/plugin install senioros@senioros`);
- `senior risk --base <ref>` assesses a branch or PR (merge-base diff plus uncommitted and untracked work);
- risk output (text and JSON) states which change scope was assessed;
- proof checks carry a `reason` when skipped or when the runner cannot start;
- CI runs on Ubuntu and Windows.

### Fixed

- the npm package ships only the CLI build, skills and adapters (no compiled tests);
- `senior finish` on Windows no longer triggers Node 24's DEP0190 deprecation warning;
- `npm run check` failed on Windows: the skill validator now accepts CRLF and BOM manifests (`.gitattributes` also pins LF);
- `senior risk` reported `LOW` with 0 files for committed changes, and `LOW` outside a git repository; it now uses `--base` for branches and fails loudly on git errors;
- `senior risk` mangled non-ASCII paths (C-quoted escapes); git output is now parsed with `-z`;
- `senior finish --json` mixed script output into stdout, producing invalid JSON;
- checks after a failed proof step disappeared from the report; they are now `SKIP` with `not run: "<check>" failed`;
- `package.json` repository, bugs and homepage URLs pointed to a non-existent repository.

## [0.1.0] - 2026-10-25

### Added

- initial SeniorOS CLI runtime;
- project intelligence state;
- deterministic risk and proof baselines;
- portable Agent Skills for engineering, project intelligence, debugging, review, finish and skill authoring;
- Claude Code, Codex and generic skill installers;
- structural skill/eval validators;
- 18 initial eval contracts;
- CI, contribution guidance and security policy.

### Design constraints

- the CLI proof baseline does not claim universal ship readiness;
- permanent context remains intentionally small;
- destructive/external actions are not silently authorized by a skill.
