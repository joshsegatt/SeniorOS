# Security Policy

## Supported versions

SeniorOS is pre-1.0. Security fixes target the latest release and `main`.

## Threat model

Agent skills can influence tool use and code execution. Treat a skill bundle as executable supply-chain input even when its visible entry point is Markdown.

SeniorOS therefore follows these rules:

- never execute untrusted skill scripts automatically during installation;
- never overwrite existing skills silently;
- never write secrets to `.senior/`;
- keep destructive production actions outside default autonomous workflows;
- make host-specific trust boundaries explicit;
- prefer deterministic, inspectable scripts over opaque shell chains;
- surface skipped verification instead of converting it into a pass.

### What the hooks guarantee, and what they do not

The adversary SeniorOS is built for is an agent's mistake: a capable model that runs a destructive command or reports unverified work as done. It is not built to contain a hostile agent, a malicious skill or a prompt injection. That is the job of the host's own sandbox and approval settings, and of the operating system; SeniorOS adds to them and replaces none.

| Control | Enforced by | Holds when | Does not hold when |
|---|---|---|---|
| Destructive-command guard | a host hook that reads the command text before it runs | the command is readable in that text and matches a rule | the command is built or decoded at run time, runs through a tool the host gives no hook for, or the host runs no hooks (see the host table in [`ROADMAP.md`](ROADMAP.md)) |
| Guard on the agent's own settings, hooks and plugins | the same hook, on shell commands and file edits | the path is written through a shell command or an edit tool the host reports | the host has no hook before a file edit (Cursor) |
| Finish gate | a host hook when the agent stops | the project has checks to run and the hook runs | the agent ignores the message: the gate sends it back at most twice per change set and then lets it stop, so it can never loop |
| Proof status (`senior finish`, `senior prove`) | the exit codes of the project's own checks | the checks exercise the change | the checks pass without covering it: a pass shows only the cases they cover |

Limits that follow from running inside the agent's own session:

- Hooks fail open: a hook that crashes or times out does not block the agent. On Claude Code, Codex and Cursor that includes the guard, so a guard that crashes lets the command through.
- The gate's state lives in the system temporary folder and the hook log beside the hooks. Both are ordinary files the agent's user can write, so neither is tamper-proof and neither is an audit log.
- The guard's rules are a list. [`tests/guard-bypass.test.ts`](tests/guard-bypass.test.ts) records which equivalent commands are caught and which are out of scope, with the reason, so a gap is a decision and not an accident.

A way past the guard that the bypass corpus does not list, or a way to make the gate or `senior finish` report a pass that did not happen, is a vulnerability: report it as below.

## Reporting a vulnerability

Do not publish a working exploit in a public issue. Use GitHub private vulnerability reporting when it is enabled for the repository. If that channel is unavailable, open a minimal issue asking for a private security contact without disclosing exploit details.

## Scope examples

We especially care about:

- command injection in CLI arguments or generated commands;
- path traversal in skill installation;
- secret leakage into project state or logs;
- malicious skill overwrite behavior;
- unsafe default permissions;
- false-positive proof/ship status that could hide failed checks.
