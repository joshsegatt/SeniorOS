# Claude Code adapter

Claude Code discovers project-local custom skills under `.claude/skills/<skill>/SKILL.md` and user skills under `~/.claude/skills/`.

Install SeniorOS project-locally:

```bash
senior install --target claude --scope project
```

Or for your user account:

```bash
senior install --target claude --scope user
```

SeniorOS copies skills instead of symlinking them so project behavior remains explicit and portable across environments.

Do not install with `--force` unless replacing an existing skill is intentional and reviewed.
