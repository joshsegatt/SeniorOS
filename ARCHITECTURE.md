# SeniorOS Architecture

SeniorOS is split into two planes:

1. **Reasoning plane** — skills and model-facing guidance for tasks that require context, tradeoffs and explanation.
2. **Deterministic plane** — CLI/runtime code for repeatable mechanics that should not be rediscovered by a model every session.

## Current v0.1 boundaries

```text
┌────────────────────────────────────────────────────┐
│ Coding agent                                       │
│  - interprets user goal                            │
│  - reads relevant project context                  │
│  - chooses/executes engineering workflow           │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────┐
│ SeniorOS skills                                    │
│  router │ debug │ review │ finish │ authoring      │
└───────────────────────┬────────────────────────────┘
                        │ optional CLI calls
                        ▼
┌────────────────────────────────────────────────────┐
│ SeniorOS deterministic runtime                     │
│  detect stack │ risk │ proof │ install │ state     │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────┐
│ Repository / Git / package scripts                 │
└────────────────────────────────────────────────────┘
```

## Why this split exists

Model intelligence is useful for:

- intent and ambiguity;
- architecture tradeoffs;
- root-cause reasoning;
- reviewing behavior against a spec;
- explaining residual risk.

Code is better for:

- parsing project metadata;
- collecting changed files;
- running verification in a stable order;
- validating skill structure;
- copying skills into known host locations;
- producing machine-readable state.

If the model repeatedly reconstructs the same shell recipe, that recipe is a candidate for the deterministic plane.

## Project state

`.senior/` is deliberately small. It is not a transcript store.

- `project.json`: compact detected facts and schema version.
- `decisions.md`: durable decisions worth carrying across sessions.
- `work-ledger.jsonl`: append-only task/ownership events for future orchestration.
- `runtime/`: non-versioned ephemeral evidence and traces.

No secrets should ever be written to `.senior/`.

## Future layers

### Goal Engine

Turns a user request into an explicit goal contract:

- outcome;
- acceptance criteria;
- constraints;
- non-goals;
- proof required;
- blocked/approval conditions.

### Context Router

Builds minimal task-specific context instead of a permanent repository dump.

### Outer Loop

Separates `agent says done` from `goal is proven done`. The loop may re-enter implementation, debugging, review or request a human gate.

### Work Ledger

Coordinates concurrent agents with task ownership, file claims, dependencies and checkpoints.

### Proof Contracts

Repository-defined verification contracts beyond package scripts: browser evidence, API assertions, migrations, security checks, benchmark budgets and runtime probes.

### Eval Lab

Runs skills against repeatable scenarios and grades routing, process, artifacts and outcome over multiple trials.

## Compatibility rule

Core skill content must remain host-neutral. Vendor-specific metadata, paths and lifecycle hooks belong under `adapters/` or in explicitly host-specific resources.
