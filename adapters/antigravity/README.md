# Google Antigravity adapter

Antigravity discovers global customizations in `~/.gemini/config/`. This adapter adds the SeniorOS skills, a short
routing rule and three lifecycle hooks that enforce what a skill can only ask for.

## Install

1. Register the skills without copying them. Create `~/.gemini/config/skills.json`:

   ```json
   { "entries": [{ "path": "~/path/to/SeniorOS/skills" }] }
   ```

2. Put the `senior` CLI on PATH: `npm install -g senioros` (or `npm link` in a clone).
3. Append [`rules.md`](rules.md) to `~/.gemini/GEMINI.md`.
4. Copy `hooks/` to `~/.gemini/config/hooks/senioros/` and [`hooks.json`](hooks.json) to `~/.gemini/config/hooks.json`
   (merge by hand if you already have one). If you run terminal auto-execution on **Turbo**, change the guard's
   `--passthrough=ask` to `--passthrough=allow` (see below).

Open a new conversation for the changes to apply. Rules, skills and hooks are reloaded for every new conversation;
no restart is needed.

## Hooks

Decisions are logged to `hooks.log` next to the scripts.

| Hook | Event | What it does |
|---|---|---|
| `session-start.mjs` | `SessionStart` | Injects `senior inspect`, git state and the relevant `.senior/decisions.md` entries |
| `guard.mjs` | `PreToolUse` on `run_command` | Forces a human confirmation for destructive or irreversible commands (recursive deletes outside build folders, force push, `reset --hard`, `DROP`/`DELETE` without `WHERE`, deploy/publish, `curl \| sh`, printing `.env`, editing the agent's own hooks), even with terminal auto-execution on Turbo |
| `context.mjs` | `PreInvocation` | Gives the same project context the first time the agent touches a repository that was not a workspace folder (a conversation without a workspace, or a second repository) |
| `track.mjs` | `PostToolUse` | Remembers which git repositories the agent touches and edits, for `context.mjs` and the stop gate |
| `stop-gate.mjs` | `Stop` | When code changed in the workspace or an edited repository, runs `senior finish`; on a failing check, sends the agent back with the output, at most twice per change set |

Turn one off by adding `"enabled": false` to its block in `hooks.json`. The stop gate runs the project's proof
checks, so tune slow suites with `.senior/config.json` `proof.checks`.

### The guard always decides

Antigravity **denies** a tool call when a `PreToolUse` hook answers without a `decision`, so the guard answers every
command. For commands it does not flag it answers `--passthrough`:

- `ask` (default): Antigravity's own permission flow, including your Always Allow list.
- `allow`: run without a prompt, which matches Turbo auto-execution.

If the guard itself errors, it still answers the passthrough decision instead of blocking your terminal.

## Antigravity behavior these hooks depend on

Verified on Antigravity 44.4.3 with a live probe (`evals/bench/bench.mjs probe`):

- Hook commands are split on whitespace and run **without a shell**. Quotes are passed literally, so write paths
  unquoted and keep them free of spaces. Relative paths resolve from the folder that holds `hooks.json`.
- A `PreToolUse` response without a `decision` denies the call (see above).
- Conversations started without a workspace (for example through `agentapi`) get no `workspacePaths`; `track.mjs`
  fills the gap.

## Limits

- Antigravity's `agy` CLI has no `SessionStart` event, so the context hook only runs in the desktop app.
- The guard sees terminal commands only. File edits are covered by the stop gate and review, not by the guard.
- Measured behavior lives in [`evals/bench/`](../../evals/bench/README.md).
