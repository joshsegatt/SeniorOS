# Invoicing rules

Signed off by accounting (2026-08). These rules are what the tax office audits; the VAT
report and credit notes depend on them.

## Amounts

1. Every amount is an integer number of cents.
2. `line.totalCents = qty * unitCents`.
3. `subtotalCents` is the sum of the line totals.

## Discounts

4. A coupon applies to the subtotal, never to tax.
   - percent coupon: `discount = round_half_up(subtotal * percent / 100)`
   - fixed coupon: `discount = cents`
   - a discount never exceeds the subtotal.
5. `taxableCents = subtotalCents - discountCents`.

## Tax

6. Tax is computed **once per invoice**, on `taxableCents`, at the customer's country
   rate, rounded half up to the cent: `taxCents = round_half_up(taxableCents * rate)`.
7. Per-line tax (`line.taxCents`) is informational only (PDF layout). It is never summed
   to obtain the invoice tax: summing rounded line taxes drifts by a cent per line, and
   line taxes do not know about the coupon.
8. `totalCents = taxableCents + taxCents`.

Rates (basis points): CH 810, DE 1900, FR 2000, AT 2000.

## Credit notes

9. A credit note reverses the taxable amount and recomputes the tax with rule 6, so
   `invoice.totalCents + creditNote.totalCents === 0`.

## VAT report

10. The VAT report sums `taxableCents` and `taxCents` per country. For each country the
    reported tax must equal what rule 6 gives on the invoices' taxable amounts.

## Worked examples (these are in the test suite)

| Ex | Country | Lines | Coupon | Subtotal | Discount | Taxable | Tax | Total |
|----|---------|-------|--------|---------:|---------:|--------:|----:|------:|
| A | CH | 1 x 10000 | none | 10000 | 0 | 10000 | 810 | 10810 |
| B | CH | 2 x 5000 | fixed 1000 | 10000 | 1000 | 9000 | 729 | 9729 |
| C | DE | 3 lines x 333 | none | 999 | 0 | 999 | 190 | 1189 |
| D | CH | 4999 + 2501 | 10 % | 7500 | 750 | 6750 | 547 | 7297 |
| E | CH | 1 x 500 | fixed 1000 | 500 | 500 | 0 | 0 | 0 |
