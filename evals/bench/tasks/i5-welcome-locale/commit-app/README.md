# teamdesk-accounts

Account creation for TeamDesk. Three signup paths create a user and send the
welcome email:

| Path | Entry point | Where the locale comes from |
|---|---|---|
| Email + password | `src/signup/emailSignup.js` | signup form language picker |
| Team invite | `src/signup/inviteSignup.js` | the invite (chosen by the inviter) |
| SSO | `src/signup/ssoSignup.js` | the identity provider's `locale` claim |

All three call `sendWelcomeEmail` in `src/mail/welcome.js`.

- `src/i18n.js` – supported languages and locale resolution (see `docs/i18n.md`)
- `src/mail/templates.js` – welcome templates per language
- `src/mail/memoryMailer.js` – in-memory mailer used in tests and locally
- `src/users.js`, `src/invites.js` – in-memory stores

More detail: `docs/signup.md`, `docs/i18n.md`. Tests: `npm test`.
