# treasury-fx

Currency conversion for the treasury ledger. Balances are stored as **BigInt
minor units** (cents, yen, fils...) because some of our accounts, and all of the
intermediate sums, are far beyond `Number.MAX_SAFE_INTEGER`.

```js
import { parseMoney, formatMinor, convert, RateTable, totalIn } from './src/index.js';

const usd = parseMoney('92233720368547758.07', 'USD'); // 9223372036854775807n
convert(usd, 'USD', 'EUR', '0.92');                    // BigInt EUR cents

const table = new RateTable();
table.set('EUR', 'USD', '1.0834567');
table.set('USD', 'JPY', '151.237');
table.convert(1_000_00n, 'EUR', 'JPY');                // through USD

totalIn('CHF', [{ currency: 'USD', amount: 500n }, { currency: 'EUR', amount: 99n }], table);
formatMinor(-123456n, 'USD');                          // '-1,234.56'
```

The rules are in [`docs/fx-rules.md`](docs/fx-rules.md). They are the rules the
auditors check against, not suggestions.

## Layout

- `src/currencies.js`: ISO 4217 minor-unit exponents we support.
- `src/money.js`: `parseMoney`, `formatMinor`.
- `src/convert.js`: `convert(amount, from, to, rate)`.
- `src/rates.js`: `RateTable` (direct, inverse and USD-pivot lookups).
- `src/report.js`: `totalIn(target, balances, table)`.
