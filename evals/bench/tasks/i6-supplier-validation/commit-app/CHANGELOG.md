# Changelog

## 2.3.0 — 2026-10-02

- Supplier store (`src/suppliers/supplierStore.js`); supplier form validation
  still to do.
- `src/validate.js`: shared validators `isEmail`, `isPhone`, `isCountry`,
  `isPostalCode`, `isBlank`, written against `docs/validation.md`.

### Known issues

- Customer form rejects valid emails with `+` or a subdomain, e.g.
  `ana+orders@mail.example.ch` (#412). Fix: use `isEmail` from `src/validate.js`.
- Customer form postal code check ignores the country: accepts `1234` for DE
  and `12345` for CH (#415). Fix: use `isPostalCode`.

## 2.2.0 — 2026-07-15

- Customer contact form validation (`validateCustomer`).
- Error codes are `required` and `invalid`, keyed by field.

## 2.1.0 — 2026-05-03

- In-memory customer store.
