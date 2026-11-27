# tabsplit

Splits money for the billing service: a restaurant bill across people, an
order-level discount or shipping fee across invoice lines. All amounts are
integer cents.

```js
import { allocate, applyOrderAdjustments, formatCents } from './src/index.js';

allocate(10000, [1, 1, 1]);          // [3334, 3333, 3333]
allocate(-995, ['19.99', '5.01']);   // credit note split by line value

applyOrderAdjustments(lines, { discount: -1500, shipping: 795 });
```

The exact allocation rules live in [`docs/allocation.md`](docs/allocation.md).
Finance relies on two promises: **the parts always add up to the total**, and
**the result is the same on every machine and every run** (auditors re-run old
invoices).

## Modules

- `src/decimal.js`: parses weights (`'19.99'`, `0.1`, `-2`).
- `src/allocate.js`: `allocate(total, weights)`.
- `src/invoice.js`: `applyOrderAdjustments(lines, adjustments)`.
- `src/money-format.js`: `formatCents(cents)` for receipts.
