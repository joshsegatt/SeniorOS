---
name: senior-finish
description: Prove a coding task is actually complete by running available verification, reviewing the final diff, checking task-specific acceptance criteria, and reporting ship readiness without converting skipped checks into passes. Use at the end of substantive implementation or before merge/release handoff.
---

# Finish / Ship Gate

“Done” is a claim that requires evidence.

## 1. Re-read the goal

List the acceptance criteria that should now be true. Do not substitute implementation details for the user-visible or system-visible outcome.

## 2. Inspect the final change set

Check for:

- unrelated edits;
- accidental generated files;
- debug statements;
- TODO/FIXME introduced by this task;
- dependency changes;
- migrations/configuration that require special handling.

## 3. Run verification

Use existing repository commands. If the SeniorOS CLI is available, run `senior finish` for the standard package-script baseline.

Add task-specific checks when the baseline cannot prove the outcome, such as:

- original bug reproduction;
- browser flow;
- API contract test;
- migration dry run;
- security check;
- benchmark or performance budget.

## 4. Apply the risk gate

Use the task/change risk to decide whether review, rollback evidence or human approval is still required.

High-risk work is not “ready” solely because unit tests pass.

## 5. Report evidence

Use explicit states:

- `PASS` — check ran and succeeded;
- `FAIL` — check ran and failed;
- `SKIP` — check was not available or intentionally not run;
- `BLOCKED` — external condition or approval prevents completion.

## Ship status

Return exactly one semantic outcome:

- **READY** — acceptance criteria are supported by adequate evidence and no blocker remains.
- **READY WITH RESIDUAL RISK** — no blocker remains, but a named non-zero risk is accepted/visible.
- **NOT PROVEN** — implementation may be complete, but evidence is insufficient.
- **BLOCKED** — completion depends on an unresolved external condition or approval.

Never call `SKIP` a pass.
