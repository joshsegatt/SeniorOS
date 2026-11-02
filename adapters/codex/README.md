# Codex adapter

SeniorOS ships a Codex plugin ([`.codex-plugin/plugin.json`](../../.codex-plugin/plugin.json)): the `senior-*` skills
plus three hooks from [`hooks.json`](hooks.json). Each hook uses the same core as the Claude Code and Cursor plugins
([`adapters/shared/`](../shared)).

| Hook | Codex event | What it does |
|---|---|---|
| `hooks/session-start.mjs` | `SessionStart` | Adds [`rules.md`](rules.md) to the session: when to use each `senior-*` skill, the low-risk exception and the approval boundary |
| `hooks/guard.mjs` | `PreToolUse` (`Bash`, `apply_patch`) | Denies destructive or irreversible commands (force-push, `reset --hard`, `rm -rf src`, `DROP TABLE`, deploys, publishing, printing `.env`), and any command or patch that changes the agent's own settings, hooks or plugins (`.codex/config.toml`, `.codex/hooks.json`, `.codex/plugins/`, and the other hosts' equivalents). A patch is judged by the files it writes, not by its text. The agent is told to show what would be lost and to ask the user to run the command themselves. Chained commands are judged one by one |
| `hooks/stop-gate.mjs` | `Stop` | When the agent ends a turn with changed code, runs `senior finish` (or `npx senioros finish` without the CLI). A failing check sends the agent back with the output, at most twice per change set When the checks pass on a change rated medium risk or higher (`senior risk`), it sends the agent back once per session for the risk review of `senior-finish`: the two likeliest ways the change is still wrong and the evidence that rules each out. |

All three fail open: a hook error never blocks the agent.

**Why the guard denies instead of asking.** Codex's `PreToolUse` hook has no "ask the user" answer: it reports `ask`
as a hook error and runs the command anyway. Denying is the only answer that stops the command. The agent cannot
lift it, so a confirmed destructive command is run by the user.

## Install

```bash
codex plugin marketplace add joshsegatt/SeniorOS
codex plugin add senioros@senioros
```

Codex runs plugin hooks only after you trust them: open `/hooks` in Codex and trust the three SeniorOS hooks. Codex
asks again whenever the plugin's files change, for example after an update.

Skills only, without the plugin or its hooks:

```bash
senior install --target codex --scope project   # .codex/skills/
senior install --target codex --scope user      # ${CODEX_HOME:-~/.codex}/skills/
```

## How the hook commands find the plugin

Codex runs hook commands from the session's working folder and passes the plugin folder in `PLUGIN_ROOT` (and
`CLAUDE_PLUGIN_ROOT`). Each command is a short `node -e` loader that resolves the script from that variable. It has no
`$`, so it runs the same under PowerShell, which Codex uses on Windows, and POSIX shells.

The manifest points Codex at `adapters/codex/hooks.json`, so the repository's `hooks/hooks.json` (the Claude Code
plugin's hooks) is not loaded in Codex.

## Verified

On Codex CLI 0.164.0 on Windows, with the plugin installed from a local marketplace and its hooks trusted:

- Codex listed exactly the three hooks of `adapters/codex/hooks.json`;
- `SessionStart` added the rules: asked for `git reset --hard`, the agent first went to show what would be lost;
- `PreToolUse` blocked `git reset --hard HEAD` even after the prompt said the user had confirmed, and nothing ran;
- `Stop`, after an edit that broke a test with the instruction not to run tests, ran the tests, sent the agent back
  twice, then let it finish; it reported the failing test instead of "done".

The test suite runs every `hooks.json` command through the system shell on Windows and Linux in CI. Not yet tested:
Codex on macOS or Linux, and installing from the GitHub marketplace (the local marketplace was used).
