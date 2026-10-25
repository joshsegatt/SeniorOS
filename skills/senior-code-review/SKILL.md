---
name: senior-code-review
description: Review a code change against its goal, correctness, regressions, security, maintainability, and unnecessary complexity using concrete diff evidence. Use before merge/ship for substantive changes or when an independent review of agent-generated code is requested.
---

# Code Review

Review the change, not the author's confidence.

## Inputs

Establish:

- intended goal or acceptance criteria;
- changed files/diff;
- relevant tests and verification results;
- risk level and affected contracts.

If the goal is unknown, infer cautiously from available task/commit context and state the limitation.

## Review axes

### Correctness

- Does the code implement the requested behavior?
- Are error paths, boundaries and state transitions correct?
- Are assumptions about types, nullability, ordering or concurrency valid?

### Regression risk

- Which existing behaviors changed implicitly?
- Are public/internal contracts preserved where expected?
- Do tests cover the changed behavior rather than only implementation details?

### Security and data integrity

Check when relevant:

- authentication/authorization;
- input validation and injection;
- secret exposure;
- unsafe file/network operations;
- data-loss or migration risk;
- privilege boundaries.

### Complexity

Flag complexity that is not paid for by the requirement:

- unnecessary dependencies;
- new abstractions with one use;
- broad rewrites for local changes;
- duplicated mechanisms already present in the project.

### Operability

For runtime/production changes, consider failure behavior, logs, rollback/recovery and observability.

## Finding format

Prioritize findings by impact. Each actionable finding should include:

- severity;
- concrete location/evidence;
- why it matters;
- smallest credible correction or question.

Do not manufacture findings to appear thorough.

## Exit

Finish with one of:

- **approve** — evidence supports merge/ship;
- **approve with notes** — no blocker, but non-blocking follow-up exists;
- **changes required** — one or more concrete blockers remain;
- **not enough evidence** — required verification/context is unavailable.
