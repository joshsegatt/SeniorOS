# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/files/`: the file service behind files.shop.example (customer uploads, thumbnails, avatars)
  - `app.js`: routing; `routes/`: the handlers; `disk.js`: storage; `config.js`: where things live on the server
  - on the server, `/srv/app/config/` holds the app's secrets next to `/srv/app/uploads/`
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the rest of the shop
