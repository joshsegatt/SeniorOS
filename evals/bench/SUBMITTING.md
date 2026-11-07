# Measure your skill pack

Any Claude Code plugin can be measured on this bench and added to the [leaderboard](LEADERBOARD.md): the same model,
the same tasks and the same deterministic grader as every other pack, with no edit to the bench. A table is a claim
anyone can re-run, so a submission is the counts, the exact commit of every pack and the commands that produced them.

## What you need

- Node 20+, git, and [Claude Code](https://docs.claude.com/en/docs/claude-code) on your `PATH`.
- A token for isolated runs: `claude setup-token`, then `CLAUDE_CODE_OAUTH_TOKEN` in the environment (or
  `ANTHROPIC_API_KEY`). The bench never copies your login.
- Your global `~/.claude/CLAUDE.md` moved aside while the bench runs (put it back after). Claude Code reads it
  whatever the run's config folder is, and an instruction there would skew every arm. The bench refuses to start if
  your instructions still reach a run.

```bash
git clone https://github.com/joshsegatt/SeniorOS && cd SeniorOS && npm ci
node evals/bench/bench.mjs selftest      # the grader passes every good reference and fails every bad one
node evals/bench/bench.mjs isolation     # one run that must see none of your own instructions
```

## Run it

Name your pack and point at it. A source is a plugin folder (with `.claude-plugin/plugin.json`), or a repository
pinned to a full 40-character commit, so the result names exactly the code that ran:

```bash
node evals/bench/bench.mjs run --backend claude --model sonnet --trials 5 \
  --tasks o17-kiosk-checkin,o19-category-filter,o20-trial-reminders,o37-refund-report \
  --arms none,senioros,mypack --packs mypack=you/your-pack@<full commit>
```

- `--packs` takes `name=source` pairs, comma-separated. A plugin in a subfolder of its repository:
  `you/repo@<commit>#plugins/mypack`. A local folder: `mypack=../your-pack`.
- Keep `none` (the model alone) in every run: each pack is compared with it on the same tasks, so a table without it
  says nothing.
- Use 5 trials or more. With fewer, the intervals on the board are too wide to separate anything.
- Each run writes `bench.json` next to its results, with the model and the commit of every arm.

### Which tasks

| Set | Tasks | What it measures | Runs at 5 trials, 3 arms |
|---|---|---|---|
| Cause elsewhere, Sonnet | `o17`, `o19`, `o20`, `o37` | Bugs whose report names one module while the cause is in another | 60, about $10 |
| Cause elsewhere, Opus | `o36`, `o37`, `o38` | The same class, on the tasks Opus alone failed in calibration | 45, about $25 |
| Never worse, Opus | `o40`–`o47` | Work Opus already does alone: a pack should not lose it or cost much more | 120, about $55 |

`node evals/bench/bench.mjs tasks` lists every task, and [README.md](README.md) explains how each set was built. All of
these were written by agents that never saw any pack. If your pack was tuned on a task, say so in `--notes`.

## Submit

```bash
node evals/bench/bench.mjs submit ~/senioros-bench/results/<the run's folder> \
  --id mypack-sonnet-cause-elsewhere --title "Sonnet 5.5: bugs whose cause is in another module" --by "@you"
```

This writes `evals/bench/leaderboard/<id>.json` (the counts per arm and task, cost and provenance) and rebuilds
`LEADERBOARD.md`. Several folders of the same model can be merged into one submission. Open a pull request with both
files, and attach the results folder (its `*.json` files and `bench.json`, not the `runs/` transcripts) to the pull
request so the counts can be checked.

## How a table is checked

- The submission file is enough to rebuild every figure on the board; `npm test` fails if `LEADERBOARD.md` does not
  match the submissions.
- A table is marked re-run when someone other than its submitter ran the same command at the same commits and landed
  inside its interval. Until then it says so on the board.
- Packs move: a table names the commit it measured. A new version is a new submission, not an edit of the old one.

## What the bench does not measure

It measures one model, one host (Claude Code) and the task classes listed. A pack that helps on long projects, with
humans in the loop, or on other hosts can be better than its table shows. Read a table as evidence for its task class,
not a ranking of packs in general.
