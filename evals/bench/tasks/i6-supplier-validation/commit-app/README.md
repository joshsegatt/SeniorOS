# partner-registry

Registry of the customers and suppliers of a Swiss wholesale business. Both
are created from the same contact block (name, email, phone, country, postal
code).

- `src/validate.js` – shared field validators (follow `docs/validation.md`)
- `src/countries.js` – countries we trade with
- `src/customers/` – customer form validation and store
- `src/suppliers/` – supplier form validation and store (validation pending)

Validation rules: `docs/validation.md`. Release notes and known issues:
`CHANGELOG.md`. Tests: `npm test`.
