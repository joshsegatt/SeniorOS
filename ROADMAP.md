# Roadmap

SeniorOS is being built in layers so the project can earn complexity instead of cosplay it. Nothing ships because it
sounds better: it ships when the bench, a deterministic test or a run in the real host shows it.

## Where SeniorOS stands (0.9.0)

Measured (see [`evals/bench/`](evals/bench/README.md)), SeniorOS against no pack and Superpowers:
- Claude Opus core set: 24/24, 21/24 and 19/24.
- Opus held-out tasks where the cause of a reported bug is in another module: 15/15, 0/15 and 0/15; a fifth blind
  round of the same kind: 10/15, 2/15 and 5/15.
- grok-4.7: 23/26, 15/26 and 14/26.
- Gemini Pro: 21/26, 16/26 and 16/26.

The wins are the approval boundary and fixing a bug at its cause. On the other kinds of work tried, Opus alone already
scores as well. SeniorOS costs more per run and is slower on Grok.

| Host | Skills | Rules | Destructive-command guard | Finish gate | Tested in the host |
|---|---|---|---|---|---|
| Claude Code | plugin | yes | asks | yes | yes |
| Codex | plugin | yes | denies (hooks cannot ask) | yes | yes, Windows |
| Cursor | plugin | yes | asks | yes | no, CI only |
| OpenCode 1.x | plugin (`main`) | yes | fails the call | yes | yes, Windows |
| Antigravity | installer or native plugin | yes | installer only | installer only | no |
| Grok CLI | Claude Code plugin, `senior install --target grok` | yes, `AGENTS.md` | asks | yes | yes, bench |

Superpowers is ahead on reach (about 13 hosts, official stores) and breadth (15 skills: planning, TDD, subagents,
worktrees, responding to review). SeniorOS is ahead on enforcement: hooks that stop destructive commands and check the
work before "done", where Superpowers injects text.

## Done

- Portable skills, risk-adaptive router, project state, debugging, review and finish workflows (0.1)
- Deterministic stack detector, risk baseline and proof runner; skill and eval validators (0.1)
- Verification contract in `.senior/config.json` and `finish --json` (0.2)
- Regression proof: `senior prove --regression` (fails without the fix, passes with it)
- Live bench with deterministic graders: core, hard and strong sets; Gemini and Claude backends (0.3–0.5)
- Antigravity installer with guard and proof gate (0.4)
- Claude Code finish gate; guard judges chained commands one by one (0.5)
- Cursor plugin, native Antigravity plugin, shared hooks core (0.6)
- Codex plugin hooks and marketplace (0.7)
- OpenCode 1.x plugin; finish gate keeps the agent within what the user asked; guard protects each host's own
  settings, hooks and plugins (0.8.0)
- Finish gate risk review for medium-risk changes; a test command that runs no tests is not a pass; `senior risk`
  rates payment and password/encryption code; guard bypass corpus; a reported bug fixed at its cause; planning in the
  rules; guard in Grok; Opus set and Grok bench (0.9.0)
- Unreleased: `senior install --target grok`; every host's routing rules generated from one template
  (`npm run gen:rules`); the README split into `docs/`; a fifth blind round; the host installers share one rules-block
  helper

## Phase 4 — Reach that holds (in progress)

Every host gets the guard and the finish gate, and every claim of support is tested in the host.

- [x] Release 0.8.0 (OpenCode plugin, finish-gate wording)
- [x] Guard protects each host's own configuration: `.claude/settings*.json`, `.codex/` hooks and config,
      `.cursor/hooks.json`, `opencode.json`, the plugin caches, and the rules files the hooks inject
- [x] Guard bypass corpus: a table-driven test of equivalent commands (`git push --mirror`, `find -delete`,
      `python -c "shutil.rmtree(...)"`, `Remove-Item` without `-Recurse` on folders, `git checkout -- <dir>`, …),
      each either flagged or documented as out of scope
- [x] `senior setup`: detects installed hosts and installs or prints the right step for each; `senior doctor` reports
      every host (plugin present, hooks trusted)
- [ ] `senior doctor` shows the installed plugin version of each host, and Cursor's plugin state once Cursor
      documents where it records plugins
- [ ] Tested in the host: Cursor and Antigravity (needs a person with the apps), Codex and OpenCode on macOS/Linux
- [ ] GitHub Copilot CLI adapter
- [ ] OpenCode 2.x plugin API
- [ ] Hooks in the native Antigravity plugin, once plugin hook paths are documented
- [ ] Official listings: Claude Code, Cursor and Codex marketplaces (submitted by the maintainer)

## Phase 5 — Proof beyond Node

Most repositories are not a single `package.json`. Without this, the finish gate is silent on them.

- [x] Default checks for Python (`pytest` or `unittest`, `ruff`, `mypy` when configured), Go (`go vet`, `go test`)
      and Rust (`cargo test`), detected from the repository root
- [ ] JVM (`gradle test`, `mvn test`), `cargo clippy` and Make targets
- [x] Projects in subfolders (two levels) and Cargo workspaces; only the projects a change touches run (`--all` runs
      every one)
- [ ] Node workspaces: run the scripts of the packages a change touches
- [ ] Slow suites: affected tests first, the full suite in CI; a timeout reports "not verified" instead of passing
- [ ] Acceptance contracts in `.senior/acceptance/` run by `senior prove`
- [ ] Runtime and UI proof: a browser check (page renders, no console errors, a flow completes) as a proof source
- [ ] Bench tasks in Python and Go, so the claim is measured, not assumed

## Now — beat the strongest model alone (Opus set)

Order matters: the pack changes in step 2, so step 3 measures the pack that step 2 leaves.

- [x] Opus set `o1`–`o24`, written blind to the pack; calibrated on Opus alone; held-out proof on `o17`/`o19`/`o20`:
      SeniorOS 15/15, Superpowers 0/15, model alone 0/15
- [x] Fourth blind round (`o25`–`o32`: a new feature with an invariant, a refactor, a security fix with sibling paths,
      an internal API migration): Opus alone 24/24, so no pack can win there
- [x] Fifth blind round (`o34`–`o39`, the cause-elsewhere class): SeniorOS 10/15, compound-engineering 6/15,
      Superpowers and mattpocock/skills 5/15, Opus alone 2/15; cost per pass $0.65 against $0.78 to $1.17
- [ ] 1. Wider proof: a sixth blind round on kinds of work not tried yet (a data migration or backfill, a dependency
      upgrade, performance at the real volume, concurrency), calibrated on Opus alone; where Opus fails, find the
      pack's weak spot, fix it on tuning tasks, prove on held-out ones
- [ ] 2. Cost: SeniorOS runs cost about 60% more than Opus alone on the Opus set. Find where the extra goes (skill
      reads, finish-gate review, extra checks) and cut what does not move the score; target the Superpowers cost
      with the same score. The finish-gate review threshold was measured and kept: half of the reviews that led to a
      fix were on medium-risk changes
- [ ] 3. Other models: the Opus set on Sonnet, and a Codex runner (`codex exec`) to measure a GPT-class model, after
      step 2
- [ ] Never worse: every pack change re-runs `o9`–`o16` (and the core set) before it is kept

## Phase 6 — Measurement anyone can trust

- [ ] Bench runners for Codex (`codex exec`) and OpenCode (`opencode serve`), so the hosts SeniorOS supports are measured
- [ ] Strong-model runs on Opus and GPT-class models; the core set kept as the discipline benchmark
- [ ] 5+ trials per cell with confidence intervals; results reported as "better", "same" or "not separable"
- [ ] Every new task designed by an agent that read no pack, with a model-alone calibration before any comparison
- [ ] Measure the finish-gate wording change (one OpenCode run so far) and the guard on each host
- [ ] A "never worse" gate: a pack change that lowers any arm's score on the strong set does not ship
- [ ] Results published with each release, with the raw run logs that back them

## Phase 7 — Capabilities, only where they win on the bench

Each starts as a bench task the current skills fail; the skill ships only if it moves that number without losing elsewhere.

- [ ] `senior-review-response`: answer review comments with evidence, fix what is real, push back on what is not
      (in practice, Codex review found real defects in #17, #18 and #22)
- [x] Planning before the first edit: shipped as routing rules, not as a skill. The `senior-plan` skill tied the
      rules alone on `h12`/`h13` (15/16 each), so it is parked in `experiments/senior-plan/`
- [ ] Brainstorming for ambiguous requests: lay out two or three designs and ask before building. Starts as a bench
      task where the request is ambiguous and the model alone builds the wrong thing
- [ ] Study open-source coding agents (Codex CLI, OpenCode, Kimi CLI and others) for techniques in context,
      planning and verification; take ideas, not code unless the license allows it and it is credited, and ship only
      what wins on the bench
- [ ] Parallel work: worktrees, file claims, handoffs and an independent reviewer
- [ ] `senior review-pack`: a self-contained bundle for a fresh-context reviewer
- [ ] Secret-safe evidence bundle and complexity budget

## Phase 8 — Launch

- [ ] Launch posts with the measured results and the stated limits
- [ ] A short demo: the same prompt with and without SeniorOS (`t6` force-push, `t2` regression proof)
- [ ] Docs per host, one page each, with the install, what is enforced and what is not

## Packs

After the core proves stable: database safety, application security, frontend/UI quality, deployment/release,
performance, observability.

## Release rule

A roadmap item is not complete because documentation exists. It is complete when the behavior is implemented, verified,
and covered by an appropriate eval or deterministic test.
