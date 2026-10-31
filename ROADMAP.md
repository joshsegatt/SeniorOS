# Roadmap

SeniorOS is being built in layers so the project can earn complexity instead of cosplay it. Nothing ships because it
sounds better: it ships when the bench, a deterministic test or a run in the real host shows it.

## Where SeniorOS stands (0.7.0)

Measured (see [`evals/bench/`](evals/bench/README.md)): on Claude Sonnet, core set, SeniorOS 24/24, Superpowers 19/24,
no pack 17/24; it never force-pushed `main` in `t6`, and its regression test was proven in every `t2` run. The win is
discipline, proof and the approval boundary, not finding more bugs: on the hard and strong sets a strong model alone
scores as well.

| Host | Skills | Rules | Destructive-command guard | Finish gate | Tested in the host |
|---|---|---|---|---|---|
| Claude Code | plugin | yes | asks | yes | yes |
| Codex | plugin | yes | denies (hooks cannot ask) | yes | yes, Windows |
| Cursor | plugin | yes | asks | yes | no, CI only |
| OpenCode 1.x | plugin (`main`, unreleased) | yes | fails the call | yes | yes, Windows |
| Antigravity | installer or native plugin | yes | installer only | installer only | no |

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
- OpenCode 1.x plugin; finish gate keeps the agent within what the user asked (unreleased)

## Phase 4 — Reach that holds (in progress)

Every host gets the guard and the finish gate, and every claim of support is tested in the host.

- [ ] Release 0.8.0 (OpenCode plugin, finish-gate wording)
- [ ] Guard protects each host's own configuration: `.claude/settings*.json`, `.codex/` hooks and config,
      `.cursor/hooks.json`, `opencode.json`, the plugin caches, and the rules files the hooks inject
- [ ] Guard bypass corpus: a table-driven test of equivalent commands (`git push --mirror`, `find -delete`,
      `python -c "shutil.rmtree(...)"`, `Remove-Item` without `-Recurse` on folders, `git checkout -- <dir>`, …),
      each either flagged or documented as out of scope
- [ ] `senior setup`: detects installed hosts and installs or prints the right step for each; `senior doctor` reports
      every host (plugin present, hooks trusted, versions)
- [ ] Tested in the host: Cursor and Antigravity (needs a person with the apps), Codex and OpenCode on macOS/Linux
- [ ] GitHub Copilot CLI adapter
- [ ] OpenCode 2.x plugin API
- [ ] Hooks in the native Antigravity plugin, once plugin hook paths are documented
- [ ] Official listings: Claude Code, Cursor and Codex marketplaces (submitted by the maintainer)

## Phase 5 — Proof beyond Node

Most repositories are not a single `package.json`. Without this, the finish gate is silent on them.

- [ ] Default checks for Python (`pytest`, `ruff`, `mypy` when configured), Go (`go test`, `go vet`), Rust
      (`cargo test`, `cargo clippy`), JVM (`gradle test`, `mvn test`) and Make targets, detected from the repository
- [ ] Monorepos and workspaces: run the checks of the packages a change touches, not the whole tree
- [ ] Slow suites: affected tests first, the full suite in CI; a timeout reports "not verified" instead of passing
- [ ] Acceptance contracts in `.senior/acceptance/` run by `senior prove`
- [ ] Runtime and UI proof: a browser check (page renders, no console errors, a flow completes) as a proof source
- [ ] Bench tasks in Python and Go, so the claim is measured, not assumed

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
- [ ] `senior-plan`: a written plan for multi-step work, checked against the result at finish
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
