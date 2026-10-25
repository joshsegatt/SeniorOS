# SeniorOS repository instructions

## Purpose

SeniorOS is a vendor-portable engineering harness for coding agents. Keep the core host-neutral and keep permanent context small.

## Source of truth

- Architecture boundaries: `ARCHITECTURE.md`
- Roadmap: `ROADMAP.md`
- Skill authoring contract: `skills/skill-authoring/SKILL.md`
- Eval contract: `evals/README.md`
- CLI/runtime: `src/`

Read only the files relevant to the task. Do not map the entire repository for a trivial change.

## Engineering rules

- Never claim a command, test, build, or check passed unless it was actually run and its result observed.
- Prefer minimal coherent changes over broad refactors.
- Do not add a dependency when Node built-ins are sufficient without explaining why.
- Do not overwrite existing installed skills unless the user explicitly requests it or `--force` is part of the requested operation.
- Keep vendor-specific behavior out of core skills when an adapter can own it.
- Avoid secrets, credentials, personal data, or raw conversation logs in `.senior/`.
- High-risk changes must include proportionate verification and rollback/recovery thinking.

## Skill changes

When adding or materially changing a skill:

1. keep `SKILL.md` focused and under 500 lines;
2. make routing metadata describe both what and when;
3. put deep reference material in one-level-deep `references/` files;
4. put deterministic repeated mechanics in scripts;
5. define explicit evidence/exit criteria;
6. add or update at least three eval cases: trigger, non-trigger/low-risk, and failure/edge behavior;
7. run `npm run validate:skills` and `npm run validate:evals`.

## Verification

For runtime or skill changes, run:

```bash
npm run check
```

For documentation-only changes, run the relevant validators if the docs affect skill/eval structure.

## Git hygiene

Keep commits atomic. Do not rewrite shared branch history, push, publish packages, deploy, or create releases unless explicitly requested.
