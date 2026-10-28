# OpenCode adapter

SeniorOS ships an OpenCode plugin ([`plugin.mjs`](plugin.mjs)), the `main` of the `senioros` npm package. It uses the
same core as the Claude Code, Codex and Cursor plugins ([`adapters/shared/`](../shared)).

| Hook | What it does |
|---|---|
| `config` | Registers the `senior-*` skills, so OpenCode's `skill` tool lists them |
| `experimental.chat.system.transform` | Adds [`rules.md`](rules.md) to the system prompt: when to use each skill, the low-risk exception and the approval boundary |
| `tool.execute.before` | Fails destructive or irreversible `bash` calls (force-push, `reset --hard`, `rm -rf src`, `DROP TABLE`, deploys, publishing, printing `.env`). The agent is told to show what would be lost and to ask the user to run the command themselves. Chained commands are judged one by one |
| `event` (`session.idle`) | When a top-level session goes idle with changed code, runs `senior finish` (or `npx senioros finish`) in a separate Node process, and on a failing check sends the output back to the session as a new message, at most twice per change set. Subagent sessions are skipped |

Every hook except the guard fails open: an error never blocks the agent.

**Why the guard fails the call instead of asking.** OpenCode's tool hook can only let a call through or fail it.
Failing is the only answer that stops the command, and the agent cannot lift it.

## Install

Requires OpenCode 1.x and Node.js 20 or newer on `PATH`. Add the package to `opencode.json` (project or
`~/.config/opencode/opencode.json`) and restart OpenCode:

```json
{
  "plugin": ["senioros"]
}
```

OpenCode 2.x uses a different plugin API and is not supported yet.

## Verified

On OpenCode 1.14.34 on Windows, with the plugin loaded from a local path through `OPENCODE_CONFIG`:

- the six `senior-*` skills were listed and the rules were in the system prompt;
- asked for `git reset --hard`, the agent first showed what would be lost and asked; after "yes", the guard failed
  the call, nothing ran, and the agent asked the user to run it;
- on a persistent server (`opencode serve`), after an edit that broke a test with the instruction not to run tests,
  the finish gate sent the agent back twice with the failing output.

`opencode run` without `--attach` exits as soon as the agent stops, before the finish gate can send it back; the gate
works in the TUI and on a server, which stay open.

The unit tests check the hooks with a stand-in for OpenCode's client, including the finish gate on a real repository.
Not yet tested: OpenCode on macOS or Linux, and installing from npm (the package with this plugin is not published
yet).
