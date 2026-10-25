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
