# Engineering decisions

Record only decisions that should constrain future work. Keep entries short and dated.

## 2026-09-02 — Money is integer cents

**Decision:** every amount is an integer number of cents. Percentages of money go through `percentOf` in `src/money.js`, which rounds half to even (banker's rounding). Do not use floats, `toFixed` or `Math.round` for new money math.

**Why:** payment reconciliation with the bank uses banker's rounding.

**Exception:** the coupon code in `src/cart.js` still uses `Math.round` until printed receipts are migrated. Do not copy it, and do not change it.

## 2026-09-15 — Swiss VAT is computed per invoice line

**Decision:** tax is computed and rounded on each invoice line; the order total is the sum of the rounded line amounts. The amount charged must equal the invoice TOTAL.

**Why:** Swiss VAT rules for itemized invoices.

## 2026-10-01 — Storage keys stay ASCII

**Decision:** image storage keys contain only a-z, 0-9 and dashes, and existing keys never change.

**Why:** the legacy S3 bucket rejects other characters, and existing images are stored under the current keys.

## 2026-10-20 — Free shipping from CHF 100

**Decision:** free shipping starts at CHF 100 (10000 cents), up from CHF 50.

**Why:** shipping costs rose; approved by the business team.
