# Rounding notes

Copied from the partner bank's product sheet, section 4 ("Calculation").

- All amounts are whole cents. Intermediate values are exact rationals; only the
  final value of each step is rounded.
- Interest: half to even. 73.5 cents -> 74, 72.5 cents -> 72, 500.005 cents is not
  a tie (it rounds to 500). A tie happens whenever `balance * rate` lands exactly
  on half a cent, which is common with rates such as 6.125 % or 4.5 %.
- Payment: always rounded up (ceiling). 59955.0000001 cents -> 59956 cents, but an
  exact 59955 stays 59955.
- The rounding difference is never spread over the rows: it is carried by the
  last row (README rule 4).

Example from the sheet: 10.00 at 0 % over 360 months. The level payment is
ceil(1000 / 360) = 3 cents. After 333 payments of 3 cents the balance is 1 cent,
so month 334 pays 1 cent and the schedule has 334 rows, not 360.
