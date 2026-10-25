# Codex adapter

SeniorOS supports Codex skills project-locally under `.codex/skills/` and user-scoped under `${CODEX_HOME:-~/.codex}/skills/`.

Install for one project:

```bash
senior install --target codex --scope project
```

Install for the user:

```bash
senior install --target codex --scope user
```

Keep durable repository-wide conventions in `AGENTS.md`. Keep repeatable workflows in skills. Avoid stuffing large workflows into `AGENTS.md`, because permanent context should remain small.
