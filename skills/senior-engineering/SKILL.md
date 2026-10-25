---
name: senior-engineering
description: Route and execute software-engineering work with risk-adaptive planning, minimal context, proof gates, and explicit residual risk. Use for substantive coding tasks that need disciplined implementation without forcing heavyweight process onto trivial edits.
---

# Senior Engineering

Use the smallest process that can responsibly prove the requested outcome.

## 1. Establish the goal

Extract:

- desired outcome;
- observable acceptance criteria;
- important constraints and non-goals;
- whether the request includes implementation or only analysis/planning.

Do not invent product requirements when the repository or request already answers them.

## 2. Read only relevant context

Prefer this order:

1. repository instructions such as `AGENTS.md` or host equivalent;
2. `.senior/project.json` and only relevant durable decisions when present;
3. files directly implicated by the task;
4. nearby tests and analogous implementations;
5. external documentation only when local version/API evidence is insufficient.

Do not require a full repository map for a small local change.

## 3. Classify risk

If the `senior` CLI is available, use `senior risk` as a deterministic baseline after identifying/creating changes; once work is committed on a branch, use `senior risk --base <ref>` (for example `main`) so committed changes are included. Combine that signal with task semantics.

### Low

Examples: copy, comments, isolated presentation tweaks, obvious local fixes.

Proceed directly and verify proportionately.

### Medium

Examples: local feature logic, a new endpoint with contained blast radius, refactor with existing tests.

Use a short plan, targeted tests, and diff review.

### High

Examples: auth/authz, schema migrations, public contracts, payments, concurrency, deployment, security-sensitive code.

Make acceptance criteria explicit. Inspect rollback/recovery implications. Run full relevant verification and independent review when available.

### Critical / externally consequential

Examples: irreversible production data operations, credential changes, deployments, branch-history rewrites, destructive infrastructure actions.

Do not cross an approval boundary merely because implementation is technically possible. Separate preparation from the external/destructive action.

## 4. Implement the minimum coherent change

- preserve existing project patterns unless there is a concrete reason not to;
- avoid unrelated cleanup;
- avoid new dependencies when existing primitives are sufficient;
- update tests close to the behavior being changed;
- keep changes reviewable.

When uncertainty is material, verify it instead of compensating with more code.

## 5. Prove the outcome

Run the repository's real checks. Prefer the project's existing commands over invented substitutes.

If the `senior` CLI is available, `senior finish` can run the standard package-script proof baseline. Add task-specific evidence beyond that baseline when needed.

Never convert an unavailable or skipped check into a pass.

## 6. Review the diff

Ask:

- Did the change satisfy the goal?
- Did it alter behavior outside the requested scope?
- Is there a simpler implementation?
- Are error paths and edge cases covered?
- Did security, data integrity, performance or compatibility risk change?
- Did we leave debug code, dead code or misleading comments?

Use the `code-review` skill for non-trivial changes when available.

## 7. Close with evidence

Report:

- what changed;
- what was actually verified;
- any skipped/unavailable proof;
- residual risk or follow-up that still matters.

Do not claim “ready” when the available evidence does not support it.
