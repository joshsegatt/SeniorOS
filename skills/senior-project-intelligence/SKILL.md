---
name: senior-project-intelligence
description: Build or refresh concise, durable project context for coding agents without dumping the repository into permanent prompts. Use when entering an unfamiliar project, when architecture changed materially, or when repeated sessions keep rediscovering the same facts.
---

# Project Intelligence

Create durable context only for facts that are likely to matter again.

## Use when

- the project is unfamiliar and substantive work is beginning;
- stack or architecture changed materially;
- agents repeatedly rediscover the same constraints;
- an explicit project handoff needs durable engineering facts.

Do not run this process for a trivial edit that can be completed from local context.

## Process

1. Read repository-level instructions.
2. If available, run `senior inspect` to collect deterministic stack facts.
3. Inspect only the entry points needed to understand architecture boundaries.
4. Identify durable facts, not transient implementation details.
5. Initialize `.senior/` with `senior init` when appropriate.
6. Record architecture decisions only when they constrain future work.

## Good durable facts

- framework/language/package manager;
- database/ORM/auth provider;
- deployment target;
- service boundaries;
- canonical verification commands;
- important repository conventions;
- decisions such as “use Drizzle, do not introduce Prisma.”

## Do not store

- secrets or credentials;
- personal data;
- raw conversation transcripts;
- temporary debugging hypotheses;
- giant file inventories;
- facts trivially discoverable in one local file unless they prevent repeated mistakes.

## Verification

Before finishing, confirm the stored context is:

- accurate against the current repository;
- concise;
- free of secrets;
- useful across future sessions;
- not duplicating volatile data that should be re-detected.
