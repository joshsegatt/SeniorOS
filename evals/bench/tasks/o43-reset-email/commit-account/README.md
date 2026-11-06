# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/account/`: customer accounts
  - `app.js`: `createAccountApp()` → `handle(request)` returning a promise of `{ status, body }`
  - `signup.js`: sign-up and the welcome email
  - `password-reset.js`: "forgot password" requests and reset links
  - `verification.js`: re-sending the email-address verification link
  - `tokens.js`: one-time tokens (reset and verification links)
- `src/mail/`: email
  - `mailer.js`: `sendTemplate(transport, name, to, vars)` renders `templates/<name>.txt` and hands the
    message to the transport
  - `outbox.js`: the in-memory transport used in development and tests (production uses the provider's SMTP
    relay with the same `send(message)` interface)
- `src/audit/log.js`: append-only audit log (one JSON line per event)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Account emails

Every endpoint that sends an email answers only after the message has been handed to the mail transport:

- success: `202` (sign-up: `201`);
- the transport refused the message (relay down, mailbox rejected): `503 { error: 'email_unavailable' }`, so the
  customer sees "we could not send the email, please try again" instead of waiting for a mail that never comes.

`POST /password-reset` answers `202` for unknown addresses too (without sending anything), so the endpoint does
not reveal which addresses have an account.
