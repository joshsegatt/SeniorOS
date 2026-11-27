# invoicing

Builds customer invoices, credit notes, monthly statements and the quarterly VAT
report for the shop. All amounts are integer cents; there are no floats anywhere
in the money path.

- `src/invoice.js` builds an invoice from cart lines, the customer and an optional coupon.
- `src/credit-note.js` reverses an invoice (refunds, cancellations). A credit note must
  cancel its invoice to the cent.
- `src/statement.js` builds monthly customer statements and the VAT report filed with
  the tax office. The VAT report sums `invoice.taxCents` per country.
- `src/tax.js`, `src/discounts.js`, `src/money.js` hold the rates and rounding rules.

The invoicing rules (the contract the accounting team signed off) live in
[docs/invoicing.md](docs/invoicing.md), with worked examples. The tests encode those
examples; when a test and the code disagree, the spec decides.

```bash
npm test
```
