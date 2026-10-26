# Roadmap

SeniorOS is being built in layers so the project can earn complexity instead of cosplay it.

## v0.1 — Foundation

- [x] Portable Agent Skills layout
- [x] Risk-adaptive engineering router
- [x] Project intelligence state
- [x] Root-cause debugging workflow
- [x] Evidence-based review workflow
- [x] Finish/ship gate workflow
- [x] Deterministic stack detector
- [x] Deterministic risk baseline
- [x] Deterministic proof runner
- [x] Skill/eval validators
- [x] Claude Code and Codex installers
- [x] CI and repository governance

## v0.2 — Proof contracts

- [x] Repository-configurable verification contract (`.senior/config.json` `proof.checks`, 0.2.0)
- [x] Structured `finish --json` (0.2.0)
- [x] Regression proof: `senior prove --regression` (fails without the fix, passes with it)
- [ ] Acceptance contracts in `.senior/acceptance/` run by `senior prove`
- [ ] `senior review-pack` for fresh-context reviewers
- [ ] Browser/runtime proof adapters
- [ ] Secret-safe evidence bundle
- [ ] Complexity budget
- [ ] Live eval runner and public benchmark (no skill vs other packs vs SeniorOS): runner, tasks and verified grader in `evals/bench/` (Antigravity); first published results pending

## v0.3 — Context engine

- [ ] Symbol-aware repository map
- [ ] Dependency graph
- [ ] Task-scoped context selection
- [ ] Decision relevance scoring
- [ ] stale-context detection

## v0.4 — Outer loop

- [ ] Goal contracts
- [ ] completion criteria engine
- [ ] re-entry policy: build/debug/review
- [ ] blocker and approval states
- [ ] evidence-derived trust score

## v0.5 — Multi-agent

- [ ] Work ledger ownership
- [ ] file-claim conflict detection
- [ ] checkpoints and handoffs
- [ ] reviewer independence
- [ ] parallel work policies

## v0.6 — Eval Lab

- [ ] Claude Code runner
- [ ] Codex runner
- [ ] trace capture schema
- [ ] deterministic graders
- [ ] rubric graders
- [ ] repeated-trial flake detection
- [ ] regression dashboard export

## Packs

After the core proves stable:

- [ ] database safety
- [ ] application security
- [ ] frontend/UI quality
- [ ] deployment/release
- [ ] performance
- [ ] observability

## Release rule

A roadmap item is not complete because documentation exists. It is complete when the behavior is implemented, verified, and covered by an appropriate eval or deterministic test.
