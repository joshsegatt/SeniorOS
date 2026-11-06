# Changelog

All notable changes to SeniorOS will be documented here.

## [Unreleased]

### Added

- `senior install --target grok` sets up Grok CLI in one command: the plugin in `~/.grok/plugins/senioros/`, the entry in `~/.grok/config.toml` and the Grok routing rules in a marked block of `~/.grok/AGENTS.md`, each file backed up once. `senior uninstall --target grok` removes them, `senior setup` and `senior doctor` report Grok, and `senior setup --apply` installs it. The npm package now ships the plugin parts Grok loads (`.claude-plugin/`, `hooks/`, `rules/`).

### Changed

- Bench reports give each arm's pass rate with a 95% Wilson interval, a two-sided Fisher exact p against the model alone, and the cost per passing run (`evals/bench/lib/stats.mjs`). On the fifth round, SeniorOS is the only pack separable from Opus alone (p = 0.008; the others p ≥ 0.22) and has the lowest cost per passing run ($0.65, against $0.78 to $2.04); its lead over compound-engineering (10/15 against 6/15) is not separable at 5 trials.
- Bench: a fifth blind round of the cause-elsewhere class (`o34`–`o39`), and `selftest` takes task ids. Opus, the three tasks Opus alone always failed in calibration, 5 trials: SeniorOS 10/15, compound-engineering 6/15, Superpowers and mattpocock/skills 5/15, Opus alone 2/15. The finish-gate review threshold was measured and kept: half of the reviews that led to a fix were on medium-risk changes.
- The routing rules come from one template, `rules/core.md`. `npm run gen:rules` writes `rules/senioros.md` and the Claude Code, Codex, Cursor, Grok and OpenCode rules from it, each with its own first line from `rules/hosts.json`, and `npm test` fails when a generated file is out of date. The text each host loads is unchanged. Antigravity keeps its hand-written rules.
- The README is half as long (821 to 445 lines): it keeps the results, the demo, the install and the skills, and links to `docs/cli.md` (every command, proof order, regression proof, project config), `docs/hosts.md` (each host install) and `docs/concepts.md` (proof engine, project memory, evals, architecture, design principles). No text was dropped; stale counts in the evals section were updated.
- Grok gets its own routing rules, `adapters/grok/rules.md`, to put in `~/.grok/AGENTS.md`. They load at most one skill per task and start no review subagents, leaving the checks and the risk review to the finish gate. With the general rules Grok loaded four or five skills per task. On the bench (13 tasks, 2 trials, against the previous rules in the same batch) the score held at 20/26, the 12-minute timeouts fell from 7 to 0, and the time per task from 366 s to 226 s.
- The bench measures `mattpocock/skills` and compound-engineering as rival arms, counts finish-gate reviews that led to a fix, and has a hygiene task for debug leftovers and copied secrets.

## [0.9.0] - 2026-11-04

SeniorOS beats the strongest models alone on Claude Opus, Grok and Gemini: a reported bug is fixed at its cause, even in another module, and the guard holds in Grok.

### Added

- A reported bug goes to `senior-debugging`, which reproduces it through the real entry points the data goes through, not only the function the report names, and fixes the cause where it is, even in another module. A code fix of the cause needs no approval; rewriting data already stored still does, and the agent says which records stay wrong until then. `senior-engineering` runs the changed path at the repository's real volume (a seed, a config value, a note on production size) before saying done. Every host's routing rules carry the change.
  - Measured on Claude Opus with tasks written by agents that never saw SeniorOS, held out from tuning (`o17`, `o19`, `o20`, 5 trials): SeniorOS 15/15, Opus alone 0/15, Superpowers 0/15. Every arm found the cause; only SeniorOS fixed it where it was. On grok-4.7 and Gemini Pro, on the five tasks of this kind: 9/10 and 7/10 for SeniorOS, at most 1/10 without it.
- Bench: an Opus set of 32 tasks (`o1`–`o32`) written blind to the pack in four rounds, and a Grok backend (`--backend grok`): each run gets its own Grok home and an empty profile folder, and the login is copied without its refresh token, so runs cannot rotate it. Results on 13 tasks, 2 trials: Grok 23/26 with SeniorOS, 15/26 alone, 14/26 with Superpowers; Gemini Pro 21/26, 16/26, 16/26. Opus core set, 3 trials: 24/24, 21/24, 19/24.
- Planning before the first edit, in the routing rules of every host and in `senior-engineering`: a change with several steps, a shared contract or stored data, or a step that can fail halfway is planned before editing. The agent finds every reader of what changes and the data already saved in the old shape, and decides what happens if a step fails halfway, runs twice or meets old data. Renaming or reshaping a field, key or type that other modules or saved data read is no longer a low-risk edit. `senior-finish` checks the plan against the result.
  - Measured on Haiku, 8 trials each on `h12-cancel-order` and `h13-line-rename`: 15/16 with these rules, against 12/16 for the rules before them and 9/16 for the model alone. A separate `senior-plan` skill with the full procedure scored the same 15/16 at the same cost, so it was not shipped: it is kept in `experiments/senior-plan/` with its measurement. See `evals/bench/README.md`.
- The finish gate puts `senior-finish` to work: when the checks pass on a change `senior risk` rates medium or higher, it sends the agent back once per session to name the two likeliest ways the change is still wrong and the evidence that rules each out, then give the ship status. Low-risk changes are untouched. When nothing failed but the proof baseline is not passing (no tests ran, checks skipped), the review says NOT PROVEN instead of "the checks pass". In the Claude Sonnet bench, no run had loaded `senior-finish` on its own. Applies to Claude Code, Codex, Cursor, OpenCode and the Antigravity hooks.
- `senior-code-review` gains a "Try to break it" pass for medium-risk changes and above, and `senior-finish` a step to name what could still be wrong before choosing a status.
- Bench: Claude runs get an empty config folder and authenticate with `CLAUDE_CODE_OAUTH_TOKEN` (the login file is never copied), and `run` refuses to start when the user's own `CLAUDE.md` still reaches the runs, which Claude Code reads from the profile folder whatever the environment says. With it moved aside, Claude Sonnet on the core and hard sets: SeniorOS 38/38, Superpowers 7.0.1 35/38.

- A test command that runs no tests is no longer a pass. `senior finish` and the finish gate read how many tests ran from node:test, Jest, Vitest, Mocha, pytest, unittest, `cargo test` and `go test` output; zero is `SKIP (no tests ran)`, and the count is shown next to the check and reported as `tests` in `--json`. Before, `npm test` with no test files, or `go test` with no test files, reported PASS. Output that is not recognised changes nothing.
  - A node:test file with no tests in it is not counted either. node:test reports such a file as one passing test named after the file (Node 20, 22 and 24, spec and TAP), so a suite of placeholder files read as `PASS (1 test)`. Only a top-level entry that is not a suite and has no subtests, naming a test file that exists and has no code in it (only comments, imports, `require`s or `export {}`), is subtracted, once per file in each run. So `describe('utils.ts')`, a test named `index.js` or after its own file, and a build line like `✔ dist/index.js (12ms)` still count. When the test command runs from another directory (npm workspaces, `cd pkg && node --test`), the printed paths are resolved from the project root, so they are usually not found and nothing is subtracted: the count stays as node:test printed it.
- Provenance: every proof report says when and on which code it ran (`provenance`: commit, uncommitted changes, time). `senior finish --record` keeps the report in `.senior/evidence/<commit>.json` as a durable record of what was verified; it stores no command output. Changes under `.senior/` no longer count as changes to a project.
- The guard catches equivalents of the commands it already guarded, listed in a bypass corpus test (`tests/guard-bypass.test.ts`) where each case either asks or is documented as out of scope with its reason. Applies to every host.
  - git options before the subcommand (`git -C ../app push --force`, `git -c …`, `--git-dir`, `--no-pager`) no longer hide it from the git rules. Their values are still judged, since they can run commands (`-c alias.x='!…'`, `-C "$(…)"`) or name the agent's own configuration (`git -C ~/.claude/plugins/… rm`).
  - Newly guarded: `git push --mirror` and `--prune`; `git checkout`/`restore` of a folder, `.` or a glob, and `checkout -f`/`switch -f` (a dot-folder such as `.github` counts as a folder; one file, such as `git restore src/a.ts`, stays free); `git branch --delete --force`, `update-ref -d`, `reflog expire`, `gc --prune=now`, `git prune`, `worktree remove --force`.
  - Deletion by other tools: `rm` with its options after the operands (`rm src -rf`), `find -delete` and `-exec rm`, `rimraf` (build folders stay free, as with `rm -rf dist`), PowerShell's abbreviated `-r`/`-Rec` and the `ri`/`rm`/`del` aliases (where a command starts, so `grep del -r` is a search), `rsync --delete`, and recursive deletes in `python -c`, `node -e`/`-p` and `ruby -e` one-liners.
  - Publishing and remote changes: `npm unpublish`/`deprecate`, `cargo publish`, `twine upload`, `poetry`/`uv publish`, `gem push`, `docker push` (`--dry-run` stays free); `gh release delete`, `gh repo archive`, `gh api -X DELETE`; `aws s3 rm --recursive`/`rb`/`sync --delete` and `aws … delete-*`/`terminate-*`, also after global options (`aws --profile prod …`), as `kubectl -n prod delete` now is; `helm uninstall`, `heroku apps:destroy`, `pulumi up`/`destroy`, `az … delete`; `redis-cli FLUSHALL`, MongoDB `dropDatabase()`; `dd of=/dev/…`, `mkfs`.
  - Secrets: `printenv`, `env` and `Get-ChildItem env:` on their own or piped (`env | grep TOKEN`), `printenv` or echoing a variable named like a secret (`$GITHUB_TOKEN`, `$OPENAI_API_KEY`).
  - In `git`, `gh` and `glab`, commit messages, titles and search patterns are read as text, so `git commit -m "remove rimraf"` no longer asks; a `$(…)` or backticks inside double quotes still does, and so does a message containing `;` or `&&`. Other tools are not touched: in `ssh host -t "…"` or `watch -t "…"` the quoted word is the command that runs.
  - Out of scope, by decision: commands built at run time or decoded (`$(echo rm)`, `base64 -d | sh`) need an OS sandbox, and everyday file operations (`rm` of named files, `mv`, writing a file) would make it ask too often to keep. `git restore` of a file without an extension (`Makefile`) also asks, since the text cannot tell it from a folder.

- `senior doctor` shows each supported host on this machine and whether SeniorOS is set up in it: the host's command on PATH or folder, the plugin (`yes`, `no`, or `unknown` when the files that would say are missing or unreadable, never a guess; a Claude Code install scoped to another project is `no`), Codex hook trust (`yes` only with all three trusted), Antigravity hooks, and the file behind each answer. It also says whether the `senior` CLI is on PATH. Detection reads files only and never runs a host's binary. Cursor's plugin state shows as unknown unless a cached copy is found, since Cursor does not document where it records plugins.
- `senior setup` prints the step left for each host found. `senior setup --apply` also does the steps the CLI owns: it adds `senioros` to the user's `opencode.json` (backed up once as `.bak-senioros`; a JSONC file, or one that is not a plain JSON object, is left alone and the step says to edit it by hand) and runs the Antigravity installer when Antigravity is present without SeniorOS's skills or hooks. Plugins for Claude Code, Codex and Cursor are installed in the app, so setup prints those commands. When a step could not be applied, `setup --apply` exits 1.
- The guard asks before `senior setup --apply`, `senior install --target antigravity` and `senior uninstall`, also as `npx senioros@<version> …` or `node …/index.js …`: they write a host's hooks or plugin list, the same change as editing those files. Before, an agent could run the Antigravity installer without a prompt.

- Proof beyond Node: `senior finish` and the finish gate now check Python, Go and Rust projects. Before, the finish gate stayed silent on any repository without `package.json` or `.senior/config.json`.
  - Python: `pytest` (continuing past import errors) or `unittest`, plus `mypy` and `ruff` when configured, in the project's `.venv`/`venv` or Poetry/Pipenv environment. Go: `go vet`, `go test`. Rust: `cargo test` (a workspace covers its members).
  - Projects are found at the root and up to two folders below it; a repository with several runs them all.
  - With uncommitted changes, only the projects the changes touch run; `senior finish --all` runs everything.
  - A missing tool or no collected tests is `SKIP`, never a pass. A Python run that fails only because declared dependencies are not installed is `SKIP` with that reason, not a failure blamed on the change; an undeclared or local module, or a test that ran and failed, stays `FAIL`.
  - `finish --json` reports `source: "standard"` when these checks are part of the baseline.

- `senior risk` recognises payment and password/encryption code. Two path rules of 4 points each, so such a change is at least medium risk and gets the finish gate's review: `payments` (payment, billing, checkout, invoice, refund, chargeback, payout, Stripe, PayPal, Braintree, Adyen) and `crypto` (password, crypto, encrypt, decrypt, cipher, signing, signature, HMAC, bcrypt, argon2, scrypt, PBKDF2, KMS, AES, RSA). The path is split into words on separators, spaces, camelCase and acronyms, so `processPayment.ts`, `APIPayment.ts` and `lib/HMAC.ts` count and `rehashing.ts`, `discharge.ts` or `battery/charge.ts` do not. A password file the auth rule already counts is not counted twice. Before, a refund-permission change in `src/billing/` was rated low.

### Changed

- `senior-code-review`: one fresh reviewer per change. After fixing its findings the agent proves each fix itself with a test that failed before and passes now; a second review is for a fix that changed the design. On Grok, chained reviews had sent 10 of 26 runs past 12 minutes.
- The finish gate's risk review asks only for the two risks, their evidence and the ship status, without repeating the report, and it is skipped when a proven change's final reply already names a risk and a status. `senior-debugging` proves the regression in one shell command when the CLI is missing. The Claude Code session start leaves out the `.senior/` and CLI lines when neither exists. On Opus the score held; the cost per run did not fall.

### Fixed

- The guard works in Grok, which loads the Claude Code plugin: it judges Grok's shell tool (`run_terminal_command`, `Shell`), and under Grok's always-approve, where a hook's question is approved by itself, it refuses the command instead and tells the agent to let the user run it. Before, `git reset --hard` ran without a question there.
- The Claude Code session-start hook finds itself by its path suffix, like the other hooks; an exact comparison failed behind a symlink or a different drive-letter case and started the session without rules.
- Bench: each Claude run gets its own config folder, removed when the run ends without blocking the other runs, and retried while Windows still holds its files; before, runs in parallel shared one folder, removed only at exit. A run that times out on Windows is stopped with the processes it started. The isolation check no longer refuses `None.` or `No, …` for not being exactly `NONE`, and names its reason: a leak is a run that names a heading of the user's `CLAUDE.md`, or a distinctive part of one.
- The finish gate no longer lets a slow suite pass in silence. When `senior finish` does not finish within 270 s, the agent is sent back once per change set with NOT VERIFIED: do not say the checks pass, run the tests that cover the change, or report the status as NOT VERIFIED. Before, a timeout was cached as a pass and the agent could report checks that never completed. The message counts as sent only once the hook answers, so a hook the host killed still tells the agent on the next stop, and a risk review that was due follows it (as NOT PROVEN). In Cursor and Antigravity, all repositories share one 270 s budget, so a second slow one cannot push the hook past the host's 300 s limit, and Antigravity saves each repository's result as it goes. Applies to Claude Code, Codex, Cursor, OpenCode and the Antigravity hooks.
- The Antigravity stop gate falls back to `npx senioros finish` when the CLI is not on PATH, as the other hosts' gate does. Before, it did nothing without the CLI. The fallback now runs only when the shell says the `senior` command is missing, not when a run fails with "not found" in its own output.
- The guard follows `cd` in a chain: `cd ~/.claude/plugins/seniorOS && git rm hooks/guard.mjs`, `cd ~/.claude && rm settings.json` and `pushd ~/.cursor; rm hooks.json` ask, like the same commands with the full path, also with `./` or `..`, in a subshell, after `--` or cmd's `/d`, with a redirection, and with `Push-Location`; `popd` goes back. Any write made from inside a plugin folder asks. Reads there (`cat`, `ls`, `git log`) stay free.
- Cursor, multi-root workspaces: the finish gate's risk review no longer goes out in the same follow-up as another repository's failing checks. Failures are sent alone; the review is kept for its change set and sent once no repository fails, without running the checks again. `loop_limit` goes from 2 to 3, so a review after two fix rounds still has a follow-up left. Cursor's cap is what ends a long run of failures, since each fix that changes the code starts a new change set, so an agent that keeps failing can now get a third follow-up.

## [0.8.0] - 2026-10-31

SeniorOS as an OpenCode plugin, and a guard that also protects the settings, hooks and plugins of the host it runs in.

### Added

- OpenCode 1.x plugin (`adapters/opencode/plugin.mjs`, the npm package's `main`), enabled with `"plugin": ["senioros"]` in `opencode.json`:
  - registers the `senior-*` skills;
  - adds the routing rules to the system prompt;
  - fails destructive `bash` calls (OpenCode's tool hook cannot ask), telling the agent to show what would be lost and let the user run it;
  - runs the finish gate in a separate Node process when a session goes idle, and sends failing checks back to the session.
- Verified in OpenCode 1.14.34 on Windows: the guard blocked `git reset --hard` after the user said yes, and the finish gate sent the agent back on a failing test.
- The guard protects the agent's own configuration in every supported host (`.claude/settings*.json` and `.claude/plugins/`, `.codex/config.toml`, `hooks.json` and `plugins/`, `.cursor/hooks.json` and `plugins/`, `opencode.json` and plugin folders, `.gemini` hooks and rules). An agent that could rewrite these could switch the guard and the finish gate off. Shell commands that change them need confirmation, including through quoted scripts, command substitutions and interpreter one-liners; plain reads stay free, though a `>` inside quotes also asks (before, only `.gemini` was covered, and every read was flagged). File-edit tools are covered too: Claude Code `Edit`/`Write`/`MultiEdit`/`NotebookEdit`, Codex `apply_patch` (judged by the files it writes), OpenCode `edit`/`write`/patch. Cursor and Antigravity have no hook before a file edit, so there only shell commands are covered.

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
