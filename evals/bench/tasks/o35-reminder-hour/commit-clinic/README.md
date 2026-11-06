# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

The clinic's booking system. Times shown to staff and patients are clinic time (`src/clinic/config.js`); the
servers run in UTC.

- `src/clinic/`: patients and appointments
  - `appointments.js`: bookings made at the reception desk, check-in
  - `calendar-sync.js`: appointments doctors add in their own calendars, pulled every 10 minutes
  - `reminders.js`: the SMS reminder sent the day before
  - `schedule.js`: the day schedule on the reception screen
  - `no-shows.js`: the job that marks patients who did not turn up
- `src/web/booking-widget.js`: online booking from the clinic website
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
