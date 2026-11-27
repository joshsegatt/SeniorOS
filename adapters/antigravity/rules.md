## SeniorOS: engineering harness

SeniorOS skills (`senior-*`) are installed and the `senior` CLI is on PATH.

- **Low-risk edits** (copy, labels, comments, an obvious one-file fix, even when the same string appears in two or three files): edit directly, run the affected tests, report the command and result in a line or two. Do not load `senior-*` skills for them. Renaming or reshaping a field, key or type that other modules or saved data read is not a low-risk edit, and neither is a reported bug, even when the report names the one function to fix.
- **Routing:** start every other task that changes behavior, spans several files or touches a risky surface (auth, data, stored records, migrations, public APIs, CI, deployment) by activating `senior-engineering`; when it also has several steps, changes a shared contract or stored data, or can fail halfway, plan it before the first edit: find every reader of what changes and the data already saved in the old shape, and decide what happens if a step fails halfway, runs twice or meets old data. Bugs, failing tests, regressions and any report of wrong output or data, even one that names the function to fix: load `senior-debugging` before reading the code; it fixes the cause where the bad data is written, even in another module than the one reported. Reviewing a diff: `senior-code-review`. Before saying done/fixed/passing, and before a commit or PR: `senior-finish`. Setting up or refreshing the project memory in `.senior/`: `senior-project-intelligence`. Creating or changing a `SKILL.md`: `senior-skill-authoring`.
- **Project state:** if the repository has no `.senior/`, suggest `senior init` (do not run it without approval the first time). Read `.senior/project.json` and only the decisions in `.senior/decisions.md` relevant to the task. Record new architecture decisions there.
- **Goal over method:** when the request also says how to do it (update the test, add a retry, change a TTL or timeout, silence a warning, copy code, touch only one function or file), write the goal in one line before the first edit. Check every claim the request makes about the code ("X already works", "it is a one-liner", "the test is wrong") by reading or running the paths the goal names, and check the method against the goal and the project's docs (README, docs/, decisions, changelog). Use the method only if it reaches the goal and breaks nothing the docs require; otherwise reach the goal the right way, even outside the named function or file, and once the cause is fixed drop a prescribed change that is no longer needed. Your report says, under **Not applied**, each suggestion you did not follow and why.
- **Risk:** once you know which files change, run `senior risk` and treat the result as a floor. High risk needs explicit acceptance criteria, review and a rollback plan. Critical risk (irreversible data, credentials, deploys, history rewrites): prepare, verify, then stop for explicit approval. Changing code to fix the cause of the reported problem is not one of them, wherever that code is; rewriting data already saved is.
- **Proof:** never claim success without evidence produced in this session. `SKIP` is not `PASS`.
- **Close:** report what changed, what was verified (command and result), what was not verified, and the residual risk.

### CLI reference (run these directly; `senior --help` is not needed)

| Need | Command |
|---|---|
| Risk of uncommitted changes | `senior risk` |
| Risk of a branch | `senior risk --base main` |
| Proof baseline (typecheck, lint, test, build) | `senior finish` |
| Prove a regression test catches the bug | `senior prove --regression --test "<command that runs only that test>" --expect-failure "<text of the original failure>"` |
| Same, after the fix is committed | add `--base <ref>` |
| Stack facts | `senior inspect` |

Examples of `--test`: `"node --test test/cart.test.js"`, `"npm test -- cart"`, `"pytest -q tests/test_cart.py"`.
