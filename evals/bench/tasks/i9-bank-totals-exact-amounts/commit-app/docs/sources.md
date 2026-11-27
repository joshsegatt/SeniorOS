# Transaction sources

Each export is `{ source, rows: [{ date, text, amount }] }`. `date` and
`amount` are strings exactly as the bank exports them. The format depends on
the source:

| source      | currency | date         | thousands separator                | decimal | negative                       |
|-------------|----------|--------------|------------------------------------|---------|--------------------------------|
| `ubs`       | CHF      | `DD.MM.YYYY` | `'` or `’` (U+2019)                | `.`     | leading `-`                    |
| `sparkasse` | EUR      | `DD.MM.YYYY` | `.`                                | `,`     | leading `-` or trailing `-`    |
| `amex`      | USD      | `MM/DD/YYYY` | `,`                                | `.`     | `(1,234.50)` or leading `-`    |
| `qonto`     | EUR      | `YYYY-MM-DD` | space, U+00A0 or U+202F            | `,`     | leading `-` or `−` (U+2212)    |

Rules for every source:

- Surrounding whitespace is ignored; a leading `+` is allowed.
- Zero, one or two decimals (`12`, `12,5`, `12,50`). Never more.
- The thousands separator is optional, but when present it groups exactly three
  digits (`1'234'567.05`). So in a `sparkasse` export `1.234` is one thousand two
  hundred thirty-four euros, not one euro.
- Examples: `ubs` `1'234.50`, `sparkasse` `1.234,50-`, `amex` `(1,234.50)`,
  `qonto` `1 234,50`.

An amount that does not match its source's format is an error: `monthlyTotals`
must throw and name the source and the row. Never guess, never skip: a skipped
or misread row makes the month impossible to reconcile.

## Totals

`monthlyTotals(statements)` returns `{ 'YYYY-MM': { CHF: 1052215, EUR: ... } }`
in integer minor units. The totals must be exact to the cent: finance compares
them with the bank statement and any difference, even one cent, blocks the
month close.
