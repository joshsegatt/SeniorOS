# Contact block validation

Customers and suppliers share the same contact block, so both forms accept
exactly the same input. Validators for each field live in `src/validate.js`.

## Result shape

`{ ok, errors }` where `errors` maps a field name to `'required'` or
`'invalid'`, and `ok` is `true` exactly when `errors` is empty. Fields not
listed below are ignored.

## Fields

| Field | Rule | Error |
|---|---|---|
| `name` | required; surrounding spaces trimmed; at most 100 characters | `required` / `invalid` |
| `email` | required; trimmed; case-insensitive; `local@domain` where the local part uses letters, digits and `. _ % + -`, and the domain is one or more dot-separated labels (letters, digits, `-`) ending in a TLD of at least 2 letters. Plus addressing and subdomains are valid. | `required` / `invalid` |
| `phone` | optional (missing or empty is fine). When present: spaces are ignored, then it must be international E.164: `+`, a non-zero digit, then 7 to 14 more digits. National formats such as `079 123 45 67` are rejected. | `invalid` |
| `country` | required; one of `CH`, `DE`, `FR`, `IT` (upper case) | `required` / `invalid` |
| `postalCode` | required; checked against the country: `CH` 4 digits not starting with 0; `DE`, `FR`, `IT` 5 digits. Only checked for format when the country is valid. | `required` / `invalid` |

## Examples

| Input | Result |
|---|---|
| email `ana+orders@mail.example.ch` | valid |
| email `ana@example` | `invalid` |
| phone `+41 79 123 45 67` | valid |
| phone `079 123 45 67` | `invalid` |
| `CH` / `1003` | valid |
| `CH` / `12345` | `invalid` |
| `DE` / `10115` | valid |
| `DE` / `1011` | `invalid` |
