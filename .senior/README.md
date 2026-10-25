# SeniorOS project state

This directory stores concise, versionable engineering context.

- `project.json`: detected project facts.
- `decisions.md`: durable architectural/engineering decisions.
- `work-ledger.jsonl`: append-only task/ownership events for future orchestration.
- `runtime/`: ephemeral evidence and traces; do not commit.

Never store secrets or raw conversation logs here.
