# bench-docs

Backend for our team documents product. No dependencies; run the tests with `npm test`.

- `src/docs/permissions.js`: who can see what (ACLs on documents and folders, nested groups)
- `src/docs/api.js`: document endpoints
- `src/docs/memory-db.js`: in-memory database for tests and local dev; production runs the same
  interface on Postgres, one query per call
- `src/docs/seed.js`: dev data shaped like our largest customer workspace (~15k documents)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: old code from the shop days
