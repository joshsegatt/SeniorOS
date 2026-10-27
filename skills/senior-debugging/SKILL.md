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
9. **Prove the fix catches the bug** — a regression test that fails without the fix and passes with it. With the `senior` CLI, run `senior prove --regression --test "<command for that test>" --expect-failure "<text of the original failure>"` (add `--base <ref>` once the fix is committed): it reverts only the fix, watches the test fail, restores the fix byte-for-byte and re-runs. Without the CLI, revert the fix by hand and watch the test fail.
10. **Re-run the original reproduction** and the relevant suite.

In systems with several components (CI → build → deploy, API → service → database), log what enters and leaves each boundary once before theorizing; it shows which layer breaks.

## Regression check

When something used to work, inspect the working-tree changes, recent commits on the failing path, dependency/lockfile changes, migrations, configuration and environment differences. Do not assume the newest commit is guilty without evidence.

Once a commit is implicated, read its **whole** diff (`git show <sha>`), not only the lines the failing test points at. List every behavior it changed (defaults, error handling, validation, header or case handling, return values) and decide for each one whether the change was intended. A failing test usually exposes one regression out of several in the same commit; restore every unintended change and cover each with a test. When the commit message says a change was intended (a new threshold, a renamed field), keep it and update the stale test instead.

## When fixes keep failing

After three fixes that did not hold, stop patching. Repeated failures in different places usually mean the design or an assumption is wrong. Summarize what each attempt showed and discuss the structure with the user before a fourth attempt.

## Red flags

| If you notice yourself thinking… | Do this instead |
|---|---|
| "I know what this is, I've seen it before" | Reproduce it first; similar symptoms often have different causes |
| "Adding a retry/timeout will make it go away" | Find out why the operation fails |
| "I'll change these few things together to save time" | One change per experiment, or you won't know which one worked |
| "The test is wrong, I'll relax the assertion" | Prove the test is wrong from the requirements before touching it |
| "The failing test passes now, so the regression is fixed" | Re-read the guilty commit's full diff for other unintended changes |
| "The error is gone, so it's fixed" | Re-run the original reproduction and the regression test |
| "Production is down, there's no time to investigate" | Mitigate visibly (rollback, flag) if needed, then find the cause |

## Exit criteria

Close debugging only when the root cause is explained with evidence, the original failure no longer reproduces, the regression test has been seen failing and passing, relevant verification passes, and remaining uncertainty is stated.
