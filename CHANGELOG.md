# Changelog

All notable changes to SeniorOS will be documented here.

## [Unreleased]

### Added

- `senior prove --regression --test "<cmd>"`: proves a regression test catches the bug (passes with the fix, fails with it reverted, passes again restored), with `--expect-failure`, `--base`, `--fix`, `--timeout` and `--json`; evidence written to `.senior/runtime/evidence/`;
- `senior prove --restore`: restores the working tree after a proof that was killed mid-run;
- `senior-debugging` and `senior-finish` use `senior prove --regression` when the CLI is available; new eval `finish-regression-proof`;
- Google Antigravity adapter (`adapters/antigravity/`): skills registration, routing rules, and three fail-open hooks: project context at session start, a guard that forces confirmation for destructive commands, and a stop gate that runs `senior finish` before the agent may finish with changed code;
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
