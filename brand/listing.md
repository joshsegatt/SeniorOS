# Directory listings

What to paste into each plugin directory's submission form, so every listing says the same thing and makes
no claim the bench does not back. The icon is `.claude-plugin/icon.png` (1024 px, square, the mark on the
Midnight tile with a quarter of clear space). Some directories fix the icon at the first submission, so
change it before submitting, not after.

## Shared copy

- **Name:** SeniorOS (`senioros`)
- **One line:** Engineering discipline for coding agents, measured on a public bench.
- **Short description (under 160 characters):** A guard that asks before destructive commands, a finish gate
  that runs your checks before the agent says done, and skills that trace a bug to its cause.
- **Long description:**
  SeniorOS sizes the process to the risk of each change. It asks before destructive commands (force-pushes,
  deletes, history rewrites), runs your project's checks before the agent reports it is done, and loads
  skills for debugging, code review and finishing that look past the file a report names.

  Every claim is measured on an open bench with hidden tests: on bugs whose cause is in another module,
  Sonnet 5.5 passed 12 of 20 runs with SeniorOS against 0 of 20 alone (p < 0.001), and Opus 5.5 10 of 15
  against 2 of 15. Any plugin can be measured the same way: evals/bench/SUBMITTING.md.
- **Category:** Developer Tools
- **Keywords:** skills, engineering, debugging, code review, verification, guardrails
- **Links:** repository and homepage https://github.com/joshsegatt/SeniorOS, license Apache-2.0,
  leaderboard https://github.com/joshsegatt/SeniorOS/blob/main/evals/bench/LEADERBOARD.md
- **Example prompts:** "This test started failing, find the cause." / "Review this branch before I merge it."
- **Demo:** brand/social/proof.mp4 (60 s, two recorded runs of the same model on the same bug).

## Claude Code plugin directory

- Form: claude.ai/settings/plugins/submit (or platform.claude.com/plugins/submit). Submit the GitHub link.
- Before submitting: `claude plugin validate .` passes; its only warning is the contributor `CLAUDE.md` at the
  repository root, which is not plugin context.
- The marketplace name `senioros` is permanent once published; change labels with `displayName`.

## Cursor marketplace

- Form: cursor.com/marketplace/publish (sign in, submit the repository link). Manual review.
- Manifest: `.cursor-plugin/plugin.json` (name, displayName, description, version, author, license, logo,
  skills, hooks).

## Codex plugin directory

- Portal: platform.openai.com/plugins (needs the Apps Management write permission).
- The public Codex directory does not accept plugins with lifecycle hooks, and the guard and the finish gate
  are hooks. A listing there would be the skills only: package `.codex-plugin/plugin.json` without its
  `hooks` entry, plus `skills/`, and say in the description that the guard and the finish gate come with the
  full plugin from the repository's own marketplace (`codex plugin marketplace add joshsegatt/SeniorOS`, then
  `codex plugin add senioros@senioros`; see docs/hosts.md).
