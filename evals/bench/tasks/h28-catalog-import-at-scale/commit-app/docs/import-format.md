# Supplier catalog import format

CSV, UTF-8 (a BOM is accepted), comma separated, LF or CRLF line endings.
Values that contain commas, quotes or line breaks are quoted (`"..."`, with
`""` for a literal quote). Product descriptions often span several lines.

## Columns

The first record is the header. Column order is free; names are
case-insensitive.

| Column | Required | Rule |
| --- | --- | --- |
| `sku` | yes | 3-32 chars, `A-Z`, `0-9`, `-`, must not start with `-` |
| `name` | yes | not empty |
| `price` | yes | decimal, at most 2 decimals, e.g. `19.9` |
| `currency` | yes | `CHF`, `EUR` or `USD` |
| `stock` | no | non-negative integer, empty = 0 |
| `description` | no | free text |

Every data row must have as many fields as the header. Completely empty lines
are skipped.

## Result

`importCatalog(text, { existing })` returns `{ products, errors, stats }`.

- `products`: one entry per SKU, `{ sku, name, priceCents, currency, stock,
  description, line, action }`, where `action` is `update` when the SKU is in
  `existing` and `create` otherwise.
- **Order**: products are listed in file order. If a SKU appears on several
  valid rows, the last of those rows wins and the product is listed at that
  row's position; the earlier rows are counted in `stats.duplicates`. An
  invalid row never replaces a valid one.
- `errors`: `{ line, sku, message }` for every rejected row, in file order.
  `sku` is the trimmed SKU text of the row, or `null` when it is empty or the
  field count is wrong.
- **`line`** (on products and errors) is the physical line of the file where
  the row starts, counting from 1 for the header line. Skipped blank lines and
  line breaks inside quoted values count, so the number matches what the
  supplier sees in their editor.
- `stats`: `{ created, updated, duplicates, errors }`.

A file-level problem (empty file, missing required column, unterminated quote)
throws `ImportError` and imports nothing.

## Size

Supplier files reach 250,000 rows. The import runs inside the admin request,
which the load balancer cuts at 30 seconds.
