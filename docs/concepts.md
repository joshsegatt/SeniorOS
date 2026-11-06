# How SeniorOS is built

The ideas behind the harness: proof, project memory, evals, architecture and the principles that decide what goes in. Back to the [README](../README.md).

## Proof Engine

The Proof Engine exists because **“the model believes it worked” is not a production signal**.

```text
available project checks
          ↓
typecheck / lint / tests / build
          ↓
 PASS / FAIL / SKIP per check
          ↓
      proof baseline
          ↓
agent/human evaluates task-specific acceptance criteria
```

SeniorOS deliberately separates **repository checks** from **task truth**.

A green build is evidence. It does not automatically prove that a business flow, browser interaction, external integration, or data migration is correct unless that behavior was actually verified.

Future proof layers are planned around runtime assertions, browser evidence, security checks, regression baselines, task-specific acceptance contracts, and trace evidence.

---

## Project Memory

`senior init` creates explicit project memory instead of hoping conversation history behaves like an architecture database.

Example:

```markdown
## 2026-10-25 — Database ORM

Decision: Keep Drizzle.
Reason: Existing repository uses Drizzle consistently.
Do not: Introduce Prisma for unrelated features.
```

Important context becomes:

- versionable;
- inspectable;
- reviewable;
- portable across sessions and agents.

Runtime-only state belongs under `.senior/runtime/` and stays out of Git.

---

## Evals

SeniorOS treats evals as product engineering, not post-launch decoration.

SeniorOS has **51 eval cases** covering the core skills, and a **live bench** of trap tasks that runs real agents
(Claude Code, Grok CLI, Google Antigravity) with and without skill packs; see [the bench](../evals/bench/README.md).

Each case captures intent such as:

```json
{
  "prompt": "task shown to the agent",
  "expected": {
    "shouldTrigger": true,
    "requiredBehaviors": ["observable behavior"],
    "forbiddenBehaviors": ["unwanted behavior"]
  }
}
```

Evaluation is designed in layers:

1. **Structural** — manifests, fixtures, repository invariants.
2. **Trajectory** — routing, files read, tools called, approvals, verification.
3. **Outcome** — builds, tests, runtime behavior, forbidden side effects.
4. **Rubric** — model grading only where human-like judgment is genuinely necessary.

See [`evals/README.md`](../evals/README.md).

---

## Architecture

```text
SeniorOS
│
├── Runtime CLI
│   ├── project intelligence
│   ├── risk engine
│   ├── proof engine
│   ├── work ledger
│   └── host installer
│
├── Agent Skills
│   ├── senior engineering router
│   ├── project intelligence
│   ├── debugging
│   ├── review
│   ├── finish
│   └── authoring
│
├── Evals
│
├── Host adapters
│   ├── Claude Code
│   ├── Codex, Cursor, OpenCode
│   ├── Antigravity, Grok CLI
│   └── generic Agent Skills
│
└── Project state
    └── .senior/
```

The long-term system direction expands toward:

```text
Goal Engine
Context Router
Risk Engine
Skill Router
Execution Engine
Proof Engine
Review Engine
Outer Loop
Work Ledger
Project Memory
Eval Lab
Observability
Host Adapters
```

Read [`ARCHITECTURE.md`](../ARCHITECTURE.md) for system boundaries.

---

## Design principles

1. **Proof over confidence** — observable evidence beats confident prose.
2. **Risk-adaptive process** — a typo and a production migration do not deserve the same ritual.
3. **Progressive disclosure** — load deeper guidance only when relevant.
4. **Deterministic mechanics belong in code** — repeated checks should not depend on model memory.
5. **Context is a budget** — read what is needed, not everything available.
6. **Durable project intelligence** — important decisions should survive the current chat.
7. **No surprise destructive actions** — production, credentials, irreversible data changes, deployment, and history rewrites require explicit boundaries.
8. **Portable by default** — the engineering layer should not belong to a single model vendor.
9. **Evals before mythology** — better should be measured whenever it can be measured.

---

## Skill quality contract

A SeniorOS skill should:

- solve one recognizable engineering goal;
- route precisely;
- keep root `SKILL.md` concise;
- use progressive disclosure for deeper references;
- move deterministic mechanics into scripts;
- define verification and exit conditions;
- stay out of the way when heavyweight process is unnecessary;
- include eval coverage for trigger, non-trigger, and failure/edge behavior.

```bash
npm run validate:skills
npm run validate:evals
```
