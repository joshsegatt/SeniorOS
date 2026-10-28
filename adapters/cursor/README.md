# Cursor adapter

SeniorOS ships a Cursor plugin ([`.cursor-plugin/plugin.json`](../../.cursor-plugin/plugin.json)): the `senior-*` skills
plus three hooks from [`hooks.json`](hooks.json). Each hook uses the same core as the Claude Code plugin
([`adapters/shared/`](../shared)).

| Hook | Cursor event | What it does |
|---|---|---|
| `hooks/session-start.mjs` | `sessionStart` | Adds [`rules.md`](rules.md) to the conversation: when to use each `senior-*` skill, the low-risk exception and the approval boundary |
| `hooks/guard.mjs` | `beforeShellExecution` | Answers `ask` before destructive or irreversible commands (force-push, `reset --hard`, `rm -rf src`, `DROP TABLE`, deploys, publishing, printing `.env`), and `allow` (no objection, Cursor's own approval still applies) otherwise. Chained commands are judged one by one |
| `hooks/stop-gate.mjs` | `stop` | When the agent completes with changed code, runs `senior finish` (or `npx senioros finish` without the CLI). A failing check comes back as a follow-up message with the output, at most twice per change set (`loop_limit: 2`) |

All three fail open: a hook error never blocks the agent. The guard always answers with valid JSON, because Cursor
blocks a shell command when a permission hook's output is invalid.

## Install

From a clone of this repository, add the folder as a local plugin in Cursor's plugin settings, or, once SeniorOS is
listed in the Cursor marketplace:

```text
/add-plugin senioros
```

## How the hook commands find the plugin

Cursor runs `sessionStart` and `beforeShellExecution` plugin hooks from the plugin folder, but `stop` from the
workspace root, and it does not expand variables in hook commands. Each command is therefore a short `node -e` loader
that resolves the script from the `CURSOR_PLUGIN_ROOT` environment variable (falling back to the working folder). It
has no `$`, so it runs the same under PowerShell, cmd and POSIX shells.

## Verified

The test suite runs every `hooks.json` command through the system shell from a folder outside the plugin, on Windows
and Linux in CI, and checks the guard, the context and the finish gate on a real repository. It has not yet been run
inside the Cursor app.
