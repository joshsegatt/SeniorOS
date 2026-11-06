# The SeniorOS CLI

The `senior` command, from `npm install -g senioros` or `npx senioros`. Back to the [README](../README.md).


```bash
senior init
senior inspect
senior risk
senior risk --base main
senior finish
senior finish --json
senior prove --regression --test "npm test -- cart"
senior doctor
senior setup
senior setup --apply
senior install --target claude --scope project
senior install --target codex --scope project
senior install --target generic --scope project
senior install --target antigravity
senior install --target grok
senior uninstall --target antigravity
senior uninstall --target grok
```

| Command | What it does |
|---|---|
| `senior init` | Creates project-level SeniorOS state and baseline intelligence files |
| `senior inspect` | Produces concise repository context for the agent |
| `senior risk` | Classifies a deterministic baseline risk from uncommitted changes |
| `senior risk --base <ref>` | Classifies a branch or PR: everything since the merge-base with `<ref>`, plus uncommitted work |
| `senior finish` | Runs available verification and reports the proof baseline |
| `senior finish --json` | Same, with a machine-readable report on stdout (script output goes to stderr) |
| `senior finish --record` | Also writes the report to `.senior/evidence/<commit>.json` (`-uncommitted` when the tree had changes): what was verified, on which commit, with which commands, exit codes and test counts. No command output is stored |
| `senior prove --regression --test "<cmd>"` | Proves a regression test catches the bug: passes with the fix, fails with it reverted, passes again restored |
| `senior prove --restore` | Puts the working tree back after a proof that was killed mid-run |
| `senior doctor` | Diagnoses SeniorOS installation/configuration problems, and shows each host on this machine (Claude Code, Codex, Cursor, OpenCode, Antigravity, Grok CLI): found or not, plugin set up (`yes`, `no` or `unknown` when the files that would say are missing), Codex hooks trusted, and the file each answer comes from |
| `senior setup` | Prints the step left for each host found, without changing anything. With `--apply`, also does the steps the CLI owns: adds `senioros` to the user's `opencode.json` (backed up once; a JSONC file is left for you) and runs the Antigravity and Grok installers. Claude Code, Codex and Cursor plugins are installed in the app. The guard asks before an agent runs `--apply` |
| `senior install` | Installs the skill pack into a supported host layout; `--target antigravity` and `--target grok` set up those hosts |

### Current proof order

```text
typecheck → lint → test → build
```

These are the `package.json` scripts. Python, Go and Rust projects get standard checks, at the repository root and up
to two folders below it (`backend/`, `services/api/`):

| Project | Detected by | Checks |
|---|---|---|
| Python | `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements.txt` | `mypy` and `ruff` when configured; `pytest`, or `unittest` when pytest is not installed. Runs in the project's `.venv`/`venv`, or its Poetry or Pipenv environment |
| Go | `go.mod` | `go vet ./...`, `go test ./...` |
| Rust | `Cargo.toml` (a workspace covers its members) | `cargo test` |

- **Only what changed:** with uncommitted changes, `senior finish` runs the projects they touch and reports the others
  as `SKIP` (`no changes in this project`); `senior finish --all` runs everything. A clean tree runs everything.
- **Never a false pass:** a tool that is not installed is `SKIP` with the reason. So is a test command that ran no
  tests, in any language: the number of tests that ran is read from node:test, Jest, Vitest, Mocha, pytest, unittest,
  `cargo test` and `go test` output, shown next to the check (`PASS test (npm run test — 42 tests)`) and reported as
  `tests` in `--json`. Output SeniorOS does not recognise changes nothing.
- **Environment or change:** a Python test run that fails only because modules the project **declares** are not
  installed is `SKIP` (`not verified: declared dependencies not installed`), not a failure the finish gate blames on
  the change. Declared means listed in a dependency declaration (`requirements*.txt`, `requirements/`, `[project]`
  dependencies and extras, dependency groups, Poetry, Pipfile, `install_requires`). A module the project does not
  declare, its own module, a test that ran and failed, or any other error in the run is a `FAIL`.
- Tests that need setup the agent's shell lacks (a database, a service) still fail: describe the real commands in
  `.senior/config.json` (`proof.checks`, below), which replaces the standard checks.

Every check is reported as `PASS`, `FAIL`, or `SKIP`. A missing test command is **SKIP**, not “tests passed” after a brief spiritual consultation.

The proof stops at the first failure; later checks are reported as `SKIP` with the reason `not run: "<check>" failed`.

`senior risk` fails with an actionable error outside a git repository or with an unknown `--base` ref, instead of reporting a misleading `LOW`.

### Regression proof

"I added a regression test" is easy to say and often untrue: the test passes with or without the fix. `senior prove --regression` checks it:

```text
$ senior prove --regression --test "node tests/cart.test.js" --expect-failure "expected 10"
Regression proof: PROVEN
  The test passes with the fix, fails without it, and passes again after restoring it.
  Fix files, reverted for run 2: src/cart.js
  Test files, kept in place:     tests/cart.test.js
  1. with the fix      PASS    exit 0  0.1s  as expected
  2. without the fix   FAIL    exit 1  0.0s  as expected
  3. fix restored      PASS    exit 0  0.0s  as expected
  Working tree restored and verified (1 file, sha256 match).
  Evidence: .senior/runtime/evidence/…-regression.json
```

- The **fix** is every changed non-test file (or what you pass with `--fix <path>`); tests stay in place.
- `--expect-failure <regex>` requires the failure to be the original bug, not, say, a syntax error.
- `--base main` proves fixes that are already committed on a branch.
- Verdicts: `PROVEN`, or `NOT PROVEN` with `fix-fails-test`, `test-misses-bug`, `failed-for-other-reason`, `unstable` (flaky) or `interrupted`.

Your work is never at risk: every file is backed up before the fix is reverted and restored byte-for-byte, verified by sha256, even on errors or Ctrl+C. If the process is killed outright, the next proof refuses to run until `senior prove --restore` puts everything back. Evidence lives in `.senior/runtime/`, which ignores itself in git.

### Project configuration

Optional `.senior/config.json` adapts the proof and the risk rules to your project, in any language:

```json
{
  "schemaVersion": 1,
  "proof": {
    "checks": [
      { "name": "lint", "command": "ruff check ." },
      { "name": "test", "command": "pytest -q" }
    ]
  },
  "risk": {
    "ignore": ["docs/**", "**/*.snap"],
    "rules": [
      { "code": "shipping", "points": 4, "reason": "Shipping rates changed.", "pattern": "^src/shipping/" }
    ]
  }
}
```

- `proof.checks` replaces the package-script baseline and runs in order; the proof stops at the first failure.
- `risk.rules` adds project rules (regular expressions over repository-relative paths) to the built-in ones. The built-in rules already cover auth, payments, passwords and encryption, database, secrets, infrastructure, CI, dependencies and public APIs; a project rule for the same files adds its points on top.
- `risk.ignore` stops matching paths from counting toward risk. It never hides the built-in secrets rule.

The file is validated strictly: an unknown key, a duplicate check name or an invalid pattern makes `senior risk` and `senior finish` fail with the exact location, so a typo cannot silently turn a gate off. `senior doctor` shows whether the config is valid.
