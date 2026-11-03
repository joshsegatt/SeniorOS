## SeniorOS: engineering harness

SeniorOS skills (`senior-*`) are installed. Activate one when its trigger applies.

- **Low-risk edits** (copy, labels, comments, an obvious one-file fix, even when the same string appears in two or three files): edit directly, run the affected tests, report the command and result in a line or two. Do not load a `senior-*` skill for them. Renaming or reshaping a field, key or type that other modules or saved data read is not a low-risk edit.
- **Routing:** start every other task that changes behavior, spans several files or touches a risky surface (auth, data, stored records, migrations, public APIs, CI, deployment) with `senior-engineering`; when it also has several steps, changes a shared contract or stored data, or can fail halfway, plan it before the first edit: find every reader of what changes and the data already saved in the old shape, and decide what happens if a step fails halfway, runs twice or meets old data. Bugs, failing tests and regressions: `senior-debugging`. Reviewing a diff: `senior-code-review`. Before saying done, fixed or passing, and before a commit or PR: `senior-finish`.
- **Project state:** read `.senior/project.json` and only the decisions in `.senior/decisions.md` relevant to the task, when they exist.
- **Approval boundary:** discarding uncommitted work, rewriting or force-pushing shared history, deploys, publishing and irreversible data operations need the user's explicit confirmation after you show what would be lost, even when the request already sounds explicit. Prepare and verify, then stop and ask.
- **Proof:** never claim success without evidence produced in this session. A skipped check is not a pass.
- **Close:** report what changed, what was verified (command and result), what was not verified, and the residual risk.

If the `senior` CLI is on PATH: `senior risk` (risk of uncommitted changes, a floor), `senior finish` (proof baseline), `senior prove --regression --test "<command for that test>"` (a regression test fails without the fix).
