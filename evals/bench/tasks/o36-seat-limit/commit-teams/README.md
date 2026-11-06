# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

Each workspace buys a number of seats. Members and pending invites take a seat; the monthly invoice bills every
member who held a seat during the month.

- `src/teams/`: workspaces and their members
  - `members.js`: workspace creation, invites and member removal from the admin UI
  - `scim.js`: SCIM provisioning from the customer's identity provider (Okta, Entra ID, ...)
  - `seats.js`: seat usage and limits
  - `billing.js`: seats on the monthly invoice
  - `api.js`: public members API (`GET /v1/workspaces/:id/members`)
- `src/web/`: members page
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
