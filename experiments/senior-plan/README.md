# senior-plan (parked experiment)

A skill that wrote a plan before the first edit: callers and stored data, acceptance criteria, what happens when a
step fails halfway, runs twice or meets old data, proof and rollback.

It is not shipped. On Claude Haiku, 8 trials each on bench tasks `h12-cancel-order` and `h13-line-rename`, the
routing rules that say when to plan scored 15/16 without the skill and 15/16 with it, at the same cost (about 61 s and
14–15 tool calls a run). The rules before it scored 12/16 and the model alone 9/16. The planning steps now live in the
routing rules and in `skills/senior-engineering/SKILL.md`. See `evals/bench/README.md`.

Worth measuring again on a task where the rules alone fail, or on a stronger model. To try it, copy this folder back to
`skills/senior-plan/`; its eval cases are in `evals/` here and in `evals/cases/plan-*.json`.
