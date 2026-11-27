# Supplier catalog import

Suppliers send product files exported from Excel. We import what we can and
send the supplier back a list of the rows we rejected, so they can fix them.

## File format

- UTF-8. Files usually start with a byte order mark (Excel writes one).
- Line endings are CRLF (Excel on Windows) or LF.
- The first line is the header. Columns are matched by name and can come in
  any order: `sku`, `name`, `description`, `price`, `stock`.
- Fields follow RFC 4180: a field may be wrapped in double quotes; inside
  quotes, commas and line breaks are part of the value and `""` is a literal
  quote. Supplier descriptions often contain commas, quotes and line breaks.
- Blank lines are ignored.

## Line numbers

A row is identified by the **physical line of the file where the row starts**,
1-based, the header being line 1. Blank lines and line breaks inside quoted
fields count. That is what the supplier sees in a text editor, so it is the
number we send back.

## Validation

Each rejected row gets exactly one reason code, the first one that applies in
this order:

1. `column_count`: the row has a different number of fields than the header.
2. `missing_sku`: `sku` is empty.
3. `missing_name`: `name` is empty.
4. `invalid_price`: `price` is not a non-negative decimal with a dot and at most
   two decimals (`12`, `12.5`, `12.50`).
5. `invalid_stock`: `stock` is not a non-negative integer.
6. `duplicate_sku`: the same `sku` was already imported from an earlier row of
   the same file. The first valid row wins; the later one is reported.

## Result

`importProducts(text, { catalog })` returns:

```js
{
  imported: 3,            // rows written to the catalog
  errors: [               // one entry per rejected row, sorted by line
    { line: 4, sku: 'B-2', reason: 'invalid_price', message: 'price "x" is not a valid amount' },
  ],
}
```

- Every valid row is imported, whatever comes before or after it.
- A rejected row never changes the catalog.
- A valid row replaces the product with the same `sku` from a previous import.
- `sku` in an error is the raw value from the file (`''` when missing).
