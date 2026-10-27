## SeniorOS: engineering harness

SeniorOS skills (`senior-*`) are installed and the `senior` CLI is on PATH.

- **Low-risk edits** (copy, labels, comments, an obvious one-file fix, even when the same string appears in two or three files): edit directly, run the affected tests, report the command and result in a line or two. Do not load `senior-*` skills for them.
- **Routing:** start every other task that changes behavior, spans several files or touches a risky surface (auth, data, migrations, public APIs, CI, deployment) by activating `senior-engineering`. Bugs and regressions: `senior-debugging`. Reviewing a diff: `senior-code-review`. Before saying done/fixed/passing, and before a commit or PR: `senior-finish`.
- **Project state:** if the repository has no `.senior/`, suggest `senior init` (do not run it without approval the first time). Read `.senior/project.json` and only the decisions in `.senior/decisions.md` relevant to the task. Record new architecture decisions there.
- **Risk:** once you know which files change, run `senior risk` and treat the result as a floor. High risk needs explicit acceptance criteria, review and a rollback plan. Critical risk (irreversible data, credentials, deploys, history rewrites): prepare, verify, then stop for explicit approval.
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
