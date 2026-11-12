# SeniorOS (skills)

The six SeniorOS skills for Claude Code: engineering sized to the risk of each change, debugging that traces a bug to
its cause even when it sits in another module, code review with evidence, finishing with real checks, project context,
and skill authoring.

This is the skills-only edition listed in the Claude plugin directory. The full plugin adds two hooks: a guard that asks
before destructive commands (force-pushes, deletes, history rewrites) and a finish gate that runs your project's checks
before the agent says it is done. Install the full plugin from the repository's own marketplace:

```
/plugin marketplace add joshsegatt/SeniorOS
/plugin install senioros@senioros
```

Every claim is measured on an open bench with hidden tests: on bugs whose cause is in another module, Sonnet 5.5 passed
12 of 20 runs with SeniorOS against 0 of 20 alone, and Opus 5.5 10 of 15 against 2 of 15. The bench numbers are for the
full plugin.

- Repository and documentation: https://github.com/joshsegatt/SeniorOS
- Leaderboard: https://github.com/joshsegatt/SeniorOS/blob/main/evals/bench/LEADERBOARD.md
- Issues: https://github.com/joshsegatt/SeniorOS/issues

These files are generated from the repository root by `npm run gen:rules`; edit the originals, not this folder.
