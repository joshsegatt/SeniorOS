# Contributing to SeniorOS

SeniorOS welcomes contributions that make agent behavior more reliable, measurable, portable or easier to reason about.

## Before writing code

Open an issue for large behavior changes. Small fixes can go directly to a pull request.

A proposal that adds process should answer:

1. Which observed failure mode does this prevent?
2. Why is model judgment alone insufficient?
3. Does the behavior belong in a skill, a script, a host adapter, or repository guidance?
4. How will we know the change helped instead of merely adding ceremony?

## Development

```bash
npm install
npm run check
```

Node 20+ is required.

## Skill contributions

Skills are workflows, not essays.

A new skill should have:

- a narrow recognizable goal;
- precise trigger metadata;
- a right-sized process;
- explicit red flags and boundaries where useful;
- verification/exit criteria;
- at least three eval cases.

Do not create a new skill when an existing one can own the behavior cleanly.

## Runtime contributions

Prefer built-in Node APIs over new dependencies for small deterministic utilities. New dependencies need a concrete maintenance or correctness benefit.

Public functions should be typed. Failure states should be explicit. CLI errors should be actionable and return a non-zero exit code.

## Pull requests

PRs should include:

- what changed;
- why it changed;
- risk level;
- commands/evidence used to verify it;
- any remaining limitation.

Do not write “tests pass” if you did not run them. Humanity has suffered enough from that sentence.
