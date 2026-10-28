# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/basket/`: baskets, coupons and the basket summary shown by the basket badge and the checkout page
- `src/cache/`: ShopKV access (`kv.js`) and every key the app stores there (`keys.js`)
- `src/cart.js`: legacy cart totals (old checkout, being retired)
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup

The shop runs as several app instances behind a load balancer; anything shared between requests lives in ShopKV.
