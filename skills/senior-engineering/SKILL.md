---
name: senior-engineering
description: Use when a coding task changes behavior, spans several files, or touches risky surfaces such as auth, data, migrations, public APIs, CI or deployment. Not for questions, explanations, or low-risk edits such as copy, labels, comments or an obvious local fix, even when the same string appears in two or three files.
---

# Senior Engineering

**Core rule:** spend the process the risk justifies — no less on risky work, no more on trivial work.

## 1. Establish the goal

Extract:

- the desired outcome and how someone would observe it;
- acceptance criteria you can check;
- constraints and non-goals;
- whether the request is implementation or only analysis/planning.

Do not invent requirements that the repository or the request already answers.

## 2. Read only relevant context

In this order, stopping when you have enough:

1. repository instructions (`AGENTS.md`, `CLAUDE.md` or the host equivalent);
2. `.senior/project.json` and only the decisions relevant to this task;
3. files directly implicated by the task;
4. nearby tests and analogous implementations;
5. external documentation, only when local version/API evidence is insufficient.

A small local change does not need a repository map.

## 3. Classify risk

If the `senior` CLI is available, run `senior risk` once you know which files change; after work is committed on a branch, run `senior risk --base <ref>` (for example `main`). Treat the score as a floor and raise it when the task semantics are riskier than the paths suggest.

| Level | Examples | Process |
|---|---|---|
| Low | copy, comments, isolated UI tweak, obvious local fix | Do it, verify proportionately, report briefly |
| Medium | local feature logic, contained endpoint, refactor with tests | Short plan, targeted tests, diff review |
| High | auth/authz, schema migration, public contract, payments, concurrency, security-sensitive code | Explicit acceptance criteria, full relevant verification, independent review, rollback/recovery check |
| Critical | irreversible data operations, credentials, deploys, history rewrites, destructive infrastructure | Prepare and verify, then stop: the external or destructive step needs the user's explicit approval |

## 4. Implement the minimum coherent change

- follow existing project patterns unless there is a concrete reason not to;
- avoid unrelated cleanup and new dependencies when existing primitives suffice;
- update tests next to the behavior that changes;
- when uncertainty matters, verify it instead of compensating with more code.

## 5. Prove the outcome

Run the repository's real checks. `senior finish` runs the standard package-script baseline; add task-specific evidence (the original reproduction, a browser flow, an API call) when the baseline cannot prove the outcome. A skipped or unavailable check is never a pass.

## 6. Review the diff

- Does it satisfy the goal, and only the goal?
- Is there a simpler implementation?
- Are error paths and edge cases covered?
- Did security, data integrity, performance or compatibility risk change?
- Is there leftover debug code, dead code or a misleading comment?

For medium risk and above, use `senior-code-review`.

## 7. Close with evidence

Report what changed, what was actually verified, what was skipped, and the residual risk that still matters. Use `senior-finish` before claiming the work is done.

## When the process starts to slip

These apply at medium risk and above.

| If you notice yourself thinking… | Do this instead |
|---|---|
| "It's basically a small change" while touching auth, data or a public contract | Classify by surface, not by line count |
| "The tests pass, so it's ready" on high-risk work | Check rollback and get an independent review |
| "I'll clean up this unrelated code while I'm here" | Leave it; mention it as a follow-up |
| "The user will obviously want this extra feature" | Ask, or list it as a suggestion |
| "I can run the deploy/migration since I prepared it" | Stop at the approval boundary |

And the reverse, at low risk: if you are writing a plan, spawning reviewers or asking clarifying questions for a one-line fix, stop and just do it.
