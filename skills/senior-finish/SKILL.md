---
name: senior-finish
description: Use right before saying work is done, fixed, passing or ready, and before committing, opening a pull request or handing off a substantive change.
---

# Finish / Ship Gate

**Core rule:** do not call it done until the proof ran in this session and you read its result.

## 1. Re-read the goal

List the acceptance criteria that should now be true, in terms of user- or system-visible outcomes, not implementation steps.

## 2. Inspect the final change set

Check for unrelated edits, accidental generated files, debug statements, new TODO/FIXME, dependency changes, and migrations or configuration that need special handling. `senior risk --base <base>` lists everything since the branch started.

## 3. Run the proof

- `senior finish` (or `senior finish --json`) runs the standard package-script baseline: typecheck, lint, test, build.
- Add task-specific evidence the baseline cannot give: the original bug reproduction, a browser flow, an API call, a migration dry run, a security check, a benchmark.
- For a bug fix, the regression test must have been seen failing without the fix: `senior prove --regression --test "<command>"` gives a `PROVEN` / `NOT PROVEN` verdict with evidence. Report `NOT PROVEN (test-misses-bug)` as a gap, not as a pass.
- Read the output itself: exit code, number of failures, warnings. A summary from a subagent or an earlier run is not proof.

## 4. Apply the risk gate

High-risk work is not ready because unit tests pass; it also needs review and a rollback or recovery answer. Destructive or external steps still need the user's approval.

## 5. Report with explicit states

- `PASS` — ran and succeeded;
- `FAIL` — ran and failed;
- `SKIP` — not available or intentionally not run;
- `BLOCKED` — an external condition or approval prevents it.

Never report a `SKIP` as a pass.

## Words that signal an unproven claim

"should work", "probably", "looks good", "seems fixed", "all set" — and any of them before a check ran in this session. Replace them with the check and its result ("`npm test`: 34 passed, 0 failed").

| If you notice yourself thinking… | Do this instead |
|---|---|
| "I ran it a few edits ago" | Run it again on the final state |
| "The subagent said everything passed" | Check the diff and run the proof yourself |
| "Lint passed, so it builds" | Run the build; each check proves only its own thing |
| "There are no tests, so there's nothing to run" | Report `SKIP` and give another form of evidence |

## Ship status

Return exactly one:

- **READY** — the acceptance criteria are supported by evidence and no blocker remains;
- **READY WITH RESIDUAL RISK** — no blocker, but a named risk is accepted and visible;
- **NOT PROVEN** — the implementation may be complete, but the evidence is insufficient;
- **BLOCKED** — completion depends on an unresolved external condition or approval.
