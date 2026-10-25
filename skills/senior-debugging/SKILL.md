---
name: senior-debugging
description: Diagnose software failures by reproducing the problem, tracing evidence, testing hypotheses, and fixing the root cause with a minimal regression-safe change. Use for bugs, failing tests/builds, runtime errors, regressions, flaky behavior, or a project that recently stopped working.
---

# Debugging

Do not patch symptoms before the root cause has credible evidence.

## Process

1. **Define the failure** — capture the exact symptom, expected behavior and relevant environment.
2. **Reproduce** — use the smallest reliable reproduction available.
3. **Collect evidence** — error output, failing test, logs, diff, recent dependency or migration change.
4. **Trace the path** — follow the execution/data path implicated by evidence.
5. **Form ranked hypotheses** — prefer a few falsifiable explanations over broad speculation.
6. **Test the hypotheses** — use targeted inspection or instrumentation.
7. **State the root cause** — distinguish confirmed cause from contributing factors.
8. **Implement the minimal fix** — do not opportunistically refactor unrelated code.
9. **Add/adjust regression evidence** — preferably a test that would have caught the bug.
10. **Run relevant verification** — include the original reproduction.

## Recent-change check

When the failure is a regression, inspect:

- current working-tree changes;
- recent commits touching the failing path;
- dependency/lockfile changes;
- migrations/configuration changes;
- environment changes.

Do not assume the newest commit is guilty without evidence.

## Red flags

- changing multiple unrelated files before reproducing;
- suppressing an error instead of fixing its cause;
- adding retries without understanding why the operation fails;
- weakening a test to make CI green;
- declaring success because one symptom disappeared while the original reproduction was not rerun.

## Exit criteria

Close debugging only when:

- the root cause is explained with evidence;
- the original failure no longer reproduces;
- relevant regression verification passes;
- residual uncertainty is stated explicitly.
