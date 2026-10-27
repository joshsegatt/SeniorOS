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

## Plugin hooks

Installed as a plugin (`/plugin install senioros@senioros`, or `claude --plugin-dir <this repo>`), SeniorOS adds two
hooks from [`hooks/hooks.json`](../../hooks/hooks.json):

| Hook | Event | What it does |
|---|---|---|
| `hooks/session-start.mjs` | `SessionStart` | Adds [`rules.md`](rules.md): when to load each `senior-*` skill, the low-risk exception and the approval boundary |
| `hooks/pretool-guard.mjs` | `PreToolUse` on `Bash` | Asks for confirmation before destructive or irreversible commands, with the same rules as the Antigravity guard; other commands keep Claude Code's normal permission flow |

Both fail open. Without the session-start rules, the bench showed that agents never loaded a SeniorOS skill on their
own (0 of 51 runs on Claude Haiku), so the plugin behaved like no pack at all.
