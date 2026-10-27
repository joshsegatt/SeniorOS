# Changelog

All notable changes to SeniorOS will be documented here.

## [Unreleased]

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
