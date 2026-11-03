# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/hotel/`: the hotel's booking system
  - `bookings.js`: direct bookings from our website and the front desk
  - `channel-sync.js`: reservations pulled every 15 minutes from the channel manager (Booking.com, Expedia, ...)
  - `guests.js`: guest profiles (repeat guests, front desk search)
  - `kiosk.js`: self check-in kiosk in the lobby
- `data/`: the latest channel manager feed, kept for debugging
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
