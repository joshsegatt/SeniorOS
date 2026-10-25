---
name: senior-debugging
description: Use when a test, build or runtime behavior fails, a feature regressed, behavior is flaky, or a previous fix did not hold. Not for explaining code that works or reviewing a change without a reported failure.
---

# Debugging

**Core rule:** no fix until the cause is backed by evidence you observed.

## Process

1. **Define the failure** — exact symptom, expected behavior, environment.
2. **Reproduce** — the smallest reliable reproduction you can get. If it does not reproduce, gather more data instead of guessing.
3. **Collect evidence** — full error output and stack trace, failing test, logs, recent diff.
4. **Trace the path** — follow the execution or data path back to where the bad value or state originates; fix there, not where it surfaces.
5. **Rank hypotheses** — two or three falsifiable explanations, most likely first.
6. **Test one hypothesis at a time** — targeted inspection or temporary instrumentation; change one variable per experiment.
7. **State the root cause** — separate the confirmed cause from contributing factors.
8. **Fix minimally** — no opportunistic refactoring.
9. **Prove the fix catches the bug** — a regression test that fails without the fix and passes with it (temporarily revert the fix to watch it fail).
10. **Re-run the original reproduction** and the relevant suite.

In systems with several components (CI → build → deploy, API → service → database), log what enters and leaves each boundary once before theorizing; it shows which layer breaks.

## Regression check

When something used to work, inspect the working-tree changes, recent commits on the failing path, dependency/lockfile changes, migrations, configuration and environment differences. Do not assume the newest commit is guilty without evidence.

## When fixes keep failing

After three fixes that did not hold, stop patching. Repeated failures in different places usually mean the design or an assumption is wrong. Summarize what each attempt showed and discuss the structure with the user before a fourth attempt.

## Red flags

| If you notice yourself thinking… | Do this instead |
|---|---|
| "I know what this is, I've seen it before" | Reproduce it first; similar symptoms often have different causes |
| "Adding a retry/timeout will make it go away" | Find out why the operation fails |
| "I'll change these few things together to save time" | One change per experiment, or you won't know which one worked |
| "The test is wrong, I'll relax the assertion" | Prove the test is wrong from the requirements before touching it |
| "The error is gone, so it's fixed" | Re-run the original reproduction and the regression test |
| "Production is down, there's no time to investigate" | Mitigate visibly (rollback, flag) if needed, then find the cause |

## Exit criteria

Close debugging only when the root cause is explained with evidence, the original failure no longer reproduces, the regression test has been seen failing and passing, relevant verification passes, and remaining uncertainty is stated.
