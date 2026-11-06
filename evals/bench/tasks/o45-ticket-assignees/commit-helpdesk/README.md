# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/tickets/`: the support helpdesk
  - `store.js`: the ticket store over `data/tickets.json` (production uses the same interface over Postgres)
  - `intake.js`: turns customer emails into tickets, with the routing rules that auto-assign them
  - `assign.js`: assigning tickets to agents
  - `inbox.js`: each agent's inbox and the triage queue (tickets nobody is assigned to)
  - `search.js`: the search box in the helpdesk (`assignee:lena status:open refund`)
  - `stats.js`: the team workload dashboard
  - `agents.js`, `format.js`: the support team and notification text
- `src/jobs/`: background jobs (SLA escalation every 15 minutes, offboarding when an agent leaves)
- `scripts/migrations/`: changes to how tickets are stored
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Stored tickets and migrations

`data/tickets.json` (and the production table) holds every ticket ever saved, with the `schemaVersion` it was
saved at. When the way a ticket is stored changes, add a numbered migration to `scripts/migrations/` (see
`001-priority-names.js`) and register it in `scripts/migrations/index.js`. The ticket store runs the pending
migrations on the tickets it opens, so the rest of the code only ever sees the current shape, and saves them at
the latest version.
