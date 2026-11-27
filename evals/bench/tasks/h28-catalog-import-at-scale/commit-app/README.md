# catalog-import

Imports supplier product catalogs (CSV) into the shop. Used by the admin
"Upload catalog" page and by the nightly supplier sync.

## Layout

| File | What it does |
| --- | --- |
| `src/importer.js` | `importCatalog(text, { existing })` |
| `src/csv.js` | CSV reader (quoted fields, multi-line values, CRLF) |
| `src/validate.js` | Per-row validation |
| `src/money.js` | Price parsing to integer cents |
| `src/report.js` | Text summary for the admin UI |
| `docs/import-format.md` | The format and the result contract (order, line numbers, duplicates) |

## Usage

```js
import { importCatalog, formatReport } from './src/index.js';

const result = importCatalog(csvText, { existing: shopProducts });
console.log(formatReport(result));
```

## Tests

```bash
npm test
```
