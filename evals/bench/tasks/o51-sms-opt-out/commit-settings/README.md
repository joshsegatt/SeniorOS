# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

Each customer's preferences (language, theme, newsletter, notification channels) are saved as one JSON document.

- `src/settings/`: customer preferences
  - `store.js`: the documents (a jsonb column in production, same interface)
  - `preferences.js`: defaults, loading and saving
- `src/api/account.js`: `PATCH /v1/account/preferences` (settings page and the app)
- `src/web/settings-page.js`: the account settings form
- `src/notify/`: order updates by SMS and email, the newsletter
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
