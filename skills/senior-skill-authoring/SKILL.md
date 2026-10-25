---
name: senior-skill-authoring
description: Create or improve a SeniorOS-quality Agent Skill with precise trigger metadata, progressive disclosure, deterministic scripts where justified, explicit verification, and eval cases. Use when adding a reusable engineering workflow or tightening an existing skill.
---

# Skill Authoring

Create skills to encode repeatable workflow, not generic advice.

## 1. Prove a skill is the right abstraction

Before creating a new skill, answer:

- What recognizable user goal should trigger it?
- Why is the behavior reusable across tasks/projects?
- Could an existing skill own this behavior instead?
- Is the content a workflow, a repository-specific rule, reference material, or deterministic mechanic?

Use repository guidance for durable project-only rules. Use a script for repeated mechanics. Use a skill for a reusable model-guided workflow.

## 2. Define routing first

Write `name` and `description` before the body.

The description must say both:

- what the skill does;
- when it should be considered.

Avoid broad descriptions that make the skill trigger on unrelated engineering work.

## 3. Keep the hot path small

`SKILL.md` should contain the minimum procedure needed when the skill triggers.

Move deep material into one-level-deep resources such as:

```text
skill-name/
├── SKILL.md
├── references/
│   └── topic.md
└── scripts/
    └── deterministic-check.mjs
```

Do not create files that the workflow does not need.

## 4. Separate judgment from mechanics

Keep in the model:

- interpretation;
- prioritization;
- tradeoffs;
- contextual review;
- explanations.

Move to scripts when behavior is:

- repeated;
- deterministic;
- fragile when manually reconstructed;
- easier to test as code.

Scripts should have clear usage, deterministic output where possible, explicit failures and safe path handling.

## 5. Define verification and boundaries

Every skill needs an exit condition. Safety-critical or destructive actions need explicit boundaries.

Do not require heavyweight approval/process for low-risk local work unless the workflow genuinely demands it.

## 6. Write evals before declaring success

Add at least three cases:

1. a request that should trigger;
2. a nearby request that should not trigger or should use a lighter path;
3. an edge/failure case that tests the skill's most important boundary.

Each eval should declare observable required and forbidden behaviors.

## 7. Validate

Run:

```bash
npm run validate:skills
npm run validate:evals
```

Then test with real agent runs when a host runner exists. Structural validation is not evidence that the skill improves agent behavior.
