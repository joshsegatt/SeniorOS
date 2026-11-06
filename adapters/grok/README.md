# Grok CLI adapter

Grok loads the Claude Code plugin, so the skills, the guard and the finish gate are the same. This folder holds the
one part that differs: the routing rules.

## Install

```bash
npx senioros install --target grok
```

It does the three steps below and backs up each file it changes; `senior uninstall --target grok` undoes them. By hand:

1. Copy the repository's `.claude-plugin/`, `hooks/`, `adapters/`, `skills/` and `rules/` into
   `~/.grok/plugins/senioros/`.
2. Enable it with `[plugins] enabled = ["senioros"]` in `~/.grok/config.toml`.
3. Put [`rules.md`](rules.md) in `~/.grok/AGENTS.md`. Grok's session-start hooks cannot add context, so this is how the
   rules reach the agent. Leave out the last line when the `senior` CLI is not installed (the installer does).

## Why Grok has its own rules

With the general rules, Grok loaded four or five `senior-*` skills per task and ran review subagents, and the
harder bench tasks hit the 12-minute limit. These rules differ only in the first paragraph: at most one skill per
task, the others only when the user asks, and no review subagents, since the finish gate runs the checks and the risk
review when the agent stops. On the bench the score held and the time per task fell by 38%
([results](../../evals/bench/README.md)).

Under Grok's always-approve, which would approve the guard's question by itself, the guard refuses the destructive
command and the user runs it.
