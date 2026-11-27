# supplier-catalog-import

Imports the product files our suppliers send (CSV exported from Excel) into the
shop catalog.

- `src/importer.js`: `importProducts(text, { catalog })`, the import.
- `src/csv.js`: CSV parsing.
- `src/validate.js`: row validation (reason codes in `src/errors.js`).
- `src/cents.js`: decimal price string to integer cents.
- `src/catalog.js`: in-memory catalog with the same API as the shop's.
- `scripts/import-catalog.js`: CLI, `npm run import -- path/to/file.csv`.

The file format, line numbering and what the import must report are in
`docs/import-format.md`.

```bash
npm test
```
