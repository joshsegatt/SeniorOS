## SeniorOS: engineering harness

SeniorOS skills (`senior-*`) are installed and the `senior` CLI is on PATH.

- **Routing:** start every task that changes behavior, spans several files or touches a risky surface (auth, data, migrations, public APIs, CI, deployment) by activating `senior-engineering`. Bugs: `senior-debugging`. Reviewing a diff: `senior-code-review`. Before saying done/fixed/passing, and before a commit or PR: `senior-finish`. Questions and one-line edits do not need the process.
- **Project state:** if the repository has no `.senior/`, suggest `senior init` (do not run it without approval the first time). Read `.senior/project.json` and only the decisions in `.senior/decisions.md` relevant to the task. Record new architecture decisions there.
- **Risk:** once you know which files change, run `senior risk` (or `senior risk --base main` on a branch) and treat the result as a floor. High risk needs explicit acceptance criteria, review and a rollback plan. Critical risk (irreversible data, credentials, deploys, history rewrites): prepare, verify, then stop for explicit approval.
- **Proof:** never claim success without evidence produced in this session. Run `senior finish` and read the result; `SKIP` is not `PASS`. For a bug fix with a new test, use `senior prove --regression --test "<cmd>"`.
- **Close:** report what changed, what was verified (command and result), what was not verified, and the residual risk.
