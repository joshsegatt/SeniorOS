# Host support

How SeniorOS installs and runs on each coding agent. Back to the [README](../README.md).


### Claude Code

```text
/plugin marketplace add joshsegatt/SeniorOS
/plugin install senioros@senioros
```

The plugin ships the skills plus two hooks: routing rules at session start and a guard that asks before destructive
`Bash` commands. The guard is a seatbelt against an agent's mistakes, not a sandbox: a command built at run time or
decoded gets past it. [`tests/guard-bypass.test.ts`](../tests/guard-bypass.test.ts) lists what it catches and what is out
of scope, with the reason. `senior install --target claude --scope project` installs the skills alone under `.claude/skills/`.

See [`adapters/claude-code/README.md`](../adapters/claude-code/README.md).

### Codex

```bash
codex plugin marketplace add joshsegatt/SeniorOS
codex plugin add senioros@senioros
```

The plugin ships the skills plus three hooks, which Codex runs once you trust them in `/hooks`: routing rules at
session start, a guard that denies destructive `Bash` commands (Codex hooks cannot ask, so the user runs a confirmed
one), and the finish gate. `senior install --target codex --scope project` installs the skills alone under
`.codex/skills/`.

See [`adapters/codex/README.md`](../adapters/codex/README.md).

### OpenCode

```json
{ "plugin": ["senioros"] }
```

The npm package's `main` is an OpenCode 1.x plugin: it registers the skills, adds the routing rules to the system
prompt, fails destructive `bash` calls (OpenCode's tool hook cannot ask, so the user runs a confirmed one), and runs
the finish gate when a session goes idle.

See [`adapters/opencode/README.md`](../adapters/opencode/README.md).

### Google Antigravity

```bash
npx senioros install --target antigravity     # add --turbo if terminal auto-execution is on Turbo
npx senioros uninstall --target antigravity   # removes only what the installer added
```

Registers the skills, adds the routing rules to `~/.gemini/GEMINI.md` and installs hooks for project context, a
destructive-command guard and the proof gate. Files it changes are backed up once; your own rules and hooks are kept.

See [`adapters/antigravity/README.md`](../adapters/antigravity/README.md). The live bench that compares SeniorOS with no pack and with other packs lives in [`evals/bench/`](../evals/bench/README.md).

### Grok CLI

Grok can load the Claude Code plugin. One command sets it up:

```bash
npx senioros install --target grok
```

1. It copies the plugin (`.claude-plugin/`, `hooks/`, `adapters/`, `skills/`, `rules/`) into `~/.grok/plugins/senioros/`.
2. It adds `"senioros"` to `[plugins] enabled` in `~/.grok/config.toml`.
3. Grok's session-start hooks cannot add context, so it puts the Grok routing rules from [`adapters/grok/rules.md`](../adapters/grok/rules.md) in a marked block of `~/.grok/AGENTS.md`. They load one skill per task and leave the checks and the risk review to the finish gate: with the general rules, Grok loaded four or five skills per task and ran review subagents.

Changed files are backed up once (`*.bak-senioros`). It never replaces a plugin folder or SeniorOS rules it did not
write unless you pass `--force`; `senior uninstall --target grok` removes what it added. `GROK_HOME` is respected.
`senior setup --apply` runs it when Grok is on the machine.

The skills, the guard and the finish gate then run as they do in Claude Code. Under Grok's always-approve, which would
approve the guard's question by itself, the guard refuses the command and the user runs it.

### Generic / portable

```bash
senior install --target generic --scope project
```

Installs into `.agents/skills/`, a neutral layout suitable for host adapters and portable packaging.
