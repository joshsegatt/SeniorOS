# Signup paths

Every path creates exactly one user (`users.add`) and sends exactly one
welcome email through `sendWelcomeEmail(mailer, user, options)`.

The user record keeps the raw locale it was created with in `user.locale`
(we do not normalise stored data; normalise when you use it, see
`docs/i18n.md`).

## Email + password

`signupWithEmail({ users, mailer }, { email, name, password, locale })`.
Password must be at least 8 characters. `locale` comes from the form picker.

## Team invite

`acceptInvite({ users, invites, mailer }, { token, name })`. The invite holds
the email and the locale the inviter picked for the new member. An invite can
be used once.

## SSO

`signupWithSso({ users, mailer }, claims)` with the identity provider's claims
`{ email, name, locale }`. The `locale` claim is POSIX style (`pt_BR`).
