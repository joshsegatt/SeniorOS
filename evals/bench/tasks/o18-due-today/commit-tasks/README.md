# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/tasks/`: the to-do app
  - `tasks.js`: tasks created in the web and mobile apps
  - `email-intake.js`: tasks created by forwarding an email to tasks@
  - `agenda.js`: the "Due today" list and the overdue reminder email
  - `calendar.js`: the calendar feed users subscribe to
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
