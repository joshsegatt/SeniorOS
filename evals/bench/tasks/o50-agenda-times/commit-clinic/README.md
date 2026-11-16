# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

The clinic app: patients book physiotherapy appointments at the desk, by phone or online. Every time is on the
clinic's wall clock (Europe/Zurich).

- `src/appointments/`: the clinic database and bookings
  - `store.js`: the database (`openStore`), production uses the same interface over Postgres
  - `booking.js`: book, reschedule and cancel (desk form and online booking page)
  - `time.js`: the clinic's wall clock
- `src/db/migrations.js`: schema migrations, run when the database is opened
- `src/web/agenda.js`: the day agenda on the desk screen
- `src/jobs/reminders.js`: reminder SMS, sent the day before
- `src/calendar/ics.js`: calendar feed each practitioner subscribes to on their phone
- `src/portal/patients.js`: "My appointments" in the patient portal
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
