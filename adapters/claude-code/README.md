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
| `hooks/pretool-guard.mjs` | `PreToolUse` on `Bash` | Asks for confirmation before destructive or irreversible commands, with the same rules as the Antigravity guard; other commands keep Claude Code's normal permission flow. Chained commands (`cd x && rm -rf dist`) are judged one by one |
| `hooks/stop-gate.mjs` | `Stop` | When code changed in the repository, runs `senior finish` (or `npx senioros finish` without the CLI) before the agent may stop; a failing check sends it back with the output, at most twice per change set. Passing change sets are not rerun |

All three fail open. The finish gate runs the project's proof checks, so declare slow or extra suites (an e2e folder
that `npm test` skips, for example) in `.senior/config.json` `proof.checks`. Without the session-start rules, the bench showed that agents never loaded a SeniorOS skill on their
own (0 of 51 runs on Claude Haiku), so the plugin behaved like no pack at all.
