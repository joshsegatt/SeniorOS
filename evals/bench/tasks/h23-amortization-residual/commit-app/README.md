# loanbook

Amortization schedules for fixed-rate and step-rate consumer loans. Used by the
back office to print schedules and by the reconciliation job that compares our
numbers with the partner bank's statements, so **every cent has to match the
rules below**. The bank is the source of truth; these rules are copied from
their product sheet (see `docs/rounding.md` for the details and examples).

## API

```js
import { buildSchedule, summarize, levelPayment, interestFor } from './src/index.js';

const rows = buildSchedule({
  principal: 25_000_000,      // integer cents (250,000.00)
  annualRate: '6.5',          // nominal annual rate in percent, decimal string
  months: 360,                // contractual term
  rateChanges: [{ month: 61, annualRate: '7.25' }], // optional
});
// rows: [{ month, payment, interest, principal, balance }, ...]  (all integer cents)

summarize(rows);
// { payments, totalPaid, totalInterest, lastPayment }
```

### Inputs

- `principal`: positive safe integer, in cents.
- `annualRate`: string, a non-negative decimal with at most 6 decimal places
  (`'0'`, `'6.5'`, `'4.125'`, `'7.123456'`). The monthly rate is exactly
  `annualRate / 100 / 12`. Anything else throws a `RangeError`.
- `months`: positive integer.
- `rateChanges`: optional list of `{ month, annualRate }`, any order, at most one
  per month. See "Rate changes".

### Exported helpers

- `interestFor(balance, annualRate)`: one month of interest on `balance` cents,
  in integer cents, rounded as described below.
- `levelPayment(balance, annualRate, n)`: the level monthly payment that repays
  `balance` cents over `n` months, in integer cents, rounded as described below.

## The rules (from the bank's product sheet)

1. **Payment.** `levelPayment` is the annuity payment
   `B * r / (1 - (1 + r)^-n)` with `r` the monthly rate, **rounded up** to the
   next whole cent. When `r` is 0 it is `B / n` rounded up.
2. **Interest.** Each month's interest is `B * r` on the balance at the start of
   the month, rounded to the cent **half to even** (banker's rounding). The
   computation is exact: no binary floating point anywhere in the money path.
3. **Principal and balance.** principal part = payment - interest; the balance
   drops by the principal part. Balances are always whole cents.
4. **Final payment.** The schedule ends on the first month where
   `balance + interest <= payment`, or on the last contractual month, whichever
   comes first. That month's payment is exactly `balance + interest` and the
   closing balance is 0. Because the level payment is rounded up, a schedule can
   end before `months`.
5. **Totals.** `totalInterest` is the sum of the monthly interest amounts,
   `totalPaid` the sum of the payments (so `totalPaid - totalInterest` is
   always the principal), `payments` the number of rows and `lastPayment` the
   payment of the last row.

## Rate changes

A change `{ month: m, annualRate }` applies to month `m` and later: the interest
of month `m` already uses the new rate. At the start of month `m` the level
payment is recomputed with `levelPayment(balance, newRate, months - m + 1)`,
where `balance` is the closing balance of month `m - 1` (the principal for
`m = 1`). Changes for months after the schedule has ended are ignored.
