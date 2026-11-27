# FX rules

## Amounts

- An amount is a `bigint` of minor units of its currency. Passing a `number`
  where an amount is expected throws a `TypeError` (a number above 2^53 is
  already corrupted, so we refuse it instead of guessing).
- Minor-unit exponents (ISO 4217): USD 2, EUR 2, CHF 2, GBP 2, JPY 0, KWD 3,
  BHD 3, CLF 4. An unknown currency code throws a `RangeError`.

## Rates

- A rate is a decimal **string** matching `\d+(\.\d+)?`, with any number of
  decimals (`'0.92'`, `'151.237'`, `'0.000006543219876543'`). It means "units of
  the target currency for one unit of the source currency" (major units, not
  minor). A rate of zero, a negative rate, exponent notation or a non-string
  throws a `RangeError`.
- Rates are used exactly as written. Converting them to a binary float, or
  truncating them to a fixed number of decimals, is a bug.

## Conversion

`convert(amount, from, to, rate)` returns the exact value
`amount * 10^-e(from) * rate * 10^e(to)` rounded to an integer number of minor
units of `to`, **half to even** (banker's rounding). Rounding is symmetric:
`-2.5 -> -2`, `-3.5 -> -4`, `2.5 -> 2`, `3.5 -> 4`.

## Rate table

`RateTable#set(from, to, rate)` stores a quoted rate. `RateTable#rate(from, to)`
and `RateTable#convert(amount, from, to)` resolve a rate in this order:

1. same currency: 1;
2. a direct quote `from -> to`;
3. the inverse of a quote `to -> from`, i.e. exactly `1 / rate` (no rounding of
   the inverse, which usually has infinitely many decimals);
4. through the pivot `USD`: the leg `from -> USD` times the leg `USD -> to`,
   where each leg is a direct quote or the inverse of one (steps 2 and 3);
5. otherwise a `RangeError`.

Whatever the path, the composed rate is exact and the amount is **rounded once**,
at the end, with the conversion rule above. Converting to USD first and then
from USD (two roundings) gives a different answer often enough to fail an audit.

`RateTable#rate(from, to)` returns the exact rate as `{ num, den }` (bigints,
`den > 0`, not necessarily reduced).

## Totals

`totalIn(target, balances, table)` with `balances = [{ currency, amount }]`:

1. sum the amounts per currency, exactly;
2. convert each currency's sum once with `table.convert` (one rounding per
   currency, not one per balance);
3. add the converted sums.

## Text

- `parseMoney(text, currency)`: `text` matches `-?\d+(\.\d+)?` with at most
  `e(currency)` decimals; more decimals than the currency has throws a
  `RangeError` (we never round silently while parsing). `'-0.00'` is `0n`.
- `formatMinor(amount, currency)`: digits grouped by three with `,`, `.` before
  the minor digits when the exponent is above 0, a leading `-` for negative
  amounts: `formatMinor(-5n, 'KWD') === '-0.005'`,
  `formatMinor(123456789n, 'JPY') === '123,456,789'`. Exact for any size.
