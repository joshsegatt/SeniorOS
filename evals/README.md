# SeniorOS Evals

SeniorOS uses evals to determine whether a skill change improved behavior instead of merely changing prose.

## Case schema

Each JSON case includes:

```json
{
  "id": "unique-id",
  "skill": "skill-name",
  "prompt": "task shown to the agent",
  "expected": {
    "shouldTrigger": true,
    "requiredBehaviors": ["observable behavior"],
    "forbiddenBehaviors": ["behavior that should not occur"]
  }
}
```

The v0.1 validator checks fixture quality and requires at least three cases per represented skill.

## Evaluation layers

### Layer 1 — structural

Deterministic validation of manifest shape, eval shape and repository invariants.

### Layer 2 — trajectory

Future host runners will capture:

- whether the intended skill routed;
- commands/tools invoked;
- files read and changed;
- verification commands;
- approvals/blocks;
- resulting artifacts.

### Layer 3 — outcome

Deterministic checks should grade what can be measured: tests, build, file changes, runtime behavior and forbidden side effects.

### Layer 4 — rubric

Model grading is reserved for properties that genuinely require judgment, such as explanation quality or architecture fit.

## Regression policy

A skill change should be compared against the previous version on the same case set. High-value cases should run multiple trials once host runners are available so flaky improvements do not masquerade as progress.
