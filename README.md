# SeniorOS

> **Engineering discipline for coding agents.**

SeniorOS is an open, vendor-portable engineering harness for coding agents. It adds the part raw model capability does not guarantee on its own: **right-sized planning, risk-aware execution, deterministic verification, durable project context, and evidence-backed completion**.

It is designed for Claude Code, Codex, and other Agent Skills-compatible CLIs without turning the repository into a wall of permanent prompt text.

[![CI](https://github.com/joshsegatt/senior-os/actions/workflows/ci.yml/badge.svg)](https://github.com/joshsegatt/senior-os/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Status](https://img.shields.io/badge/status-foundation-orange.svg)](ROADMAP.md)

## The problem

Coding agents are already good at producing code. The expensive failures happen around the code:

- reading too much context for tiny changes and too little for dangerous ones;
- changing unrelated files;
- treating “implemented” as equivalent to “verified”;
- hiding uncertainty behind confident prose;
- repeating shell mechanics instead of using deterministic tools;
- forgetting architectural decisions across sessions;
- applying the same process to a copy edit and a production migration.

SeniorOS treats those as **engineering-system problems**, not prompt-writing problems.

## The loop

```text
user goal
   │
   ▼
Goal Contract ──► Context Router ──► Risk Engine
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
             direct execution                     planned execution
                   │                                     │
                   └──────────────► Builder ◄────────────┘
                                      │
                                      ▼
                                  Proof Engine
                                      │
                                      ▼
                                 Review Engine
                                      │
                                      ▼
                                    Ship Gate
```

The model decides what requires judgment. Scripts handle repeatable mechanics. The task closes only when the available evidence supports the claim that it is done.

## Design principles

1. **Proof over confidence.** A green build is evidence. “Looks good” is not.
2. **Risk-adaptive process.** A typo does not need an architecture review. An auth migration does.
3. **Progressive disclosure.** Skills stay focused and load references only when relevant.
4. **Deterministic mechanics belong in code.** Repeated checks become scripts, not ritual prompt text.
5. **Context is a budget.** Read what the task needs, not the repository out of habit.
6. **Project memory is explicit.** Decisions and conventions are durable, inspectable artifacts.
7. **No surprise destructive actions.** Production, credentials, irreversible data changes, deployment and branch history rewrites require explicit boundaries.
8. **Portable by default.** Core workflows follow the open Agent Skills shape and host-specific behavior lives in adapters.
9. **Evals before mythology.** Improvements should be measurable instead of merely feeling more “senior.”

## What ships in v0.1

### Runtime CLI

```bash
senior init
senior inspect
senior risk
senior finish
senior doctor
senior install --target claude --scope project
senior install --target codex --scope project
senior install --target generic --scope project
```

### Core skills

| Skill | Purpose |
|---|---|
| `senior-engineering` | Risk-adaptive routing and engineering loop |
| `project-intelligence` | Build/update concise durable project context |
| `debugging` | Root-cause debugging before patching |
| `code-review` | Evidence-based review of changed code |
| `finish` | End-of-task proof and ship gate |
| `skill-authoring` | Create SeniorOS-quality skills with eval contracts |

### Project state

`senior init` creates a small, versionable project memory:

```text
.senior/
├── README.md
├── project.json
├── decisions.md
└── work-ledger.jsonl
```

Runtime-only data belongs under `.senior/runtime/` and is ignored by Git.

## Quick start from source

```bash
git clone https://github.com/joshsegatt/SeniorOS.git
cd SeniorOS
npm install
npm run check
npm run build
npm link
```

Inside a project you want SeniorOS to understand:

```bash
senior init
senior inspect
```

Install the skills for the coding agent you use:

```bash
# Claude Code, project-local
senior install --target claude --scope project

# Codex, project-local
senior install --target codex --scope project

# Portable/generic Agent Skills layout
senior install --target generic --scope project
```

The installer refuses to overwrite an existing skill unless you pass `--force`.

## Practical example

You ask your agent:

```text
Add Google authentication to this application.
```

With SeniorOS available, the intended behavior is:

```text
1. classify the goal and inspect only relevant context;
2. detect that authentication is high-risk code;
3. inspect existing auth/session/user patterns;
4. create a right-sized plan and acceptance criteria;
5. implement the smallest coherent change;
6. run the repository's real verification commands;
7. review the diff for regressions/security/complexity;
8. report evidence, residual risk and any blocker.
```

For a text-only README correction, the same system should **not** demand that workflow. It should make the edit and run proportionate verification. Senior process that cannot scale down is just bureaucracy wearing a hoodie.

## Risk engine

`senior risk` inspects changed files and emits a deterministic baseline risk score.

Examples of signals:

- authentication / authorization;
- database schema and migrations;
- deployment and infrastructure;
- secrets and environment configuration;
- dependency manifests;
- CI/CD;
- deletions and broad change sets.

The score does **not** replace model judgment. It gives the agent and the human a shared, inspectable floor for deciding which gates are appropriate.

## Proof engine

`senior finish` discovers verification scripts already defined by the project and runs what exists, in a stable order:

```text
typecheck → lint → test → build
```

It reports `PASS`, `FAIL`, or `SKIP` per check and never claims a missing check passed. The CLI reports a **proof baseline**, not universal ship readiness; task-specific acceptance criteria and risk still belong to the agent/human gate.

Future releases will add repository-specific proof contracts, runtime assertions, browser evidence, security scanners, and regression baselines.

## Skill quality contract

A SeniorOS skill should:

- solve one recognizable engineering goal;
- use precise routing metadata;
- keep `SKILL.md` concise;
- move deep reference material out of the hot path;
- use scripts only for deterministic or fragile mechanics;
- define verification and exit conditions;
- avoid forcing heavyweight process onto low-risk tasks;
- ship with at least three eval cases covering trigger, non-trigger, and failure/edge behavior.

Run:

```bash
npm run validate:skills
npm run validate:evals
```

## Evals

SeniorOS treats evals as part of product development, not documentation theater.

Each eval case describes:

```text
prompt
expected routing
required behaviors
forbidden behaviors
observable checks
```

The v0.1 repository includes the eval contract and deterministic fixture validation. Host-specific runner adapters and trace grading are on the roadmap.

See [`evals/README.md`](evals/README.md).

## Host support

### Claude Code

Project skills are installed under `.claude/skills/`. User-scoped skills use `~/.claude/skills/`.

See [`adapters/claude-code/README.md`](adapters/claude-code/README.md).

### Codex

SeniorOS supports project-local `.codex/skills/` and user-scoped `${CODEX_HOME:-~/.codex}/skills/`. The core repository also keeps `AGENTS.md` concise so Codex can work on SeniorOS itself without loading every workflow into permanent context.

See [`adapters/codex/README.md`](adapters/codex/README.md).

### Generic / portable

`--target generic` installs to `.agents/skills/`, a neutral project-local layout useful for portable packaging and adapters.

## Architecture

```text
SeniorOS
├── CLI runtime
│   ├── project intelligence
│   ├── risk engine
│   ├── proof engine
│   ├── work ledger
│   └── host installer
├── Agent Skills
│   ├── router
│   ├── debugging
│   ├── review
│   ├── finish
│   └── authoring
├── Evals
├── Host adapters
└── Repository governance
```

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for boundaries and future runtime layers.

## Non-goals

SeniorOS is not:

- another general-purpose coding agent;
- a giant persona prompt telling a model to “act senior”;
- a replacement for your test suite, CI, security program or code review;
- an excuse to let agents perform destructive production actions without explicit control;
- tied to a single model vendor.

## Roadmap

The direction is intentionally more ambitious than a skill pack:

- host-neutral Goal Engine;
- context routing and project graph;
- risk-aware outer loop;
- proof contracts and regression baselines;
- work ledger and multi-agent file ownership;
- tool contracts and controlled MCP integration;
- trace-based eval runners;
- skill packs for database, security, frontend and deployment;
- observability and trust scoring derived from evidence.

See [`ROADMAP.md`](ROADMAP.md).

## Security

Skills are executable influence over an agent. Treat third-party skills as code. SeniorOS never assumes a skill is trusted merely because it is Markdown.

See [`SECURITY.md`](SECURITY.md).

## Contributing

SeniorOS should become stricter through evidence, not longer through accumulated folklore. Contributions that add process must explain the failure mode they prevent and how that behavior will be evaluated.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE).
