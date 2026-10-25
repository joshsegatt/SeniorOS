# Changelog

All notable changes to SeniorOS will be documented here.

## [Unreleased]

### Added

- `senior risk --base <ref>` assesses a branch or PR (merge-base diff plus uncommitted and untracked work);
- risk output (text and JSON) states which change scope was assessed;
- proof checks carry a `reason` when skipped or when the runner cannot start;
- CI runs on Ubuntu and Windows.

### Fixed

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
