# Allocation rules

## `allocate(total, weights)`

Splits `total` cents into one integer part per weight, proportionally to the
weights, with the **largest remainder method**.

Inputs:

- `total`: a safe integer number of cents. It can be zero or negative (credit
  notes, discounts).
- `weights`: a non-empty array. Each weight is either a finite number or a decimal
  string matching `-?\d+(\.\d+)?`. A number is read through its shortest decimal
  form (`String(w)`, exponent forms such as `1e-7` included), so `0.1` means
  exactly one tenth, never 0.1000000000000000055511151231257827. The string
  form does not accept exponents. Weights can be zero or negative (a
  returned item, a discount line). Anything else throws a `RangeError`.

Algorithm (all arithmetic exact; binary floating point would make ties depend
on the order of operations):

1. `W` = sum of the weights. If `W` is 0: return all zeros when `total` is 0,
   otherwise throw a `RangeError`.
2. **Negative totals are mirrored.** If `total < 0`, compute the allocation of
   `-total` and negate every part. So `allocate(-t, w)` is always
   `allocate(t, w)` with the signs flipped, and a refund mirrors its original
   charge cent for cent.
3. For each weight, the exact quota is `q_i = total * w_i / W`.
4. Each part starts at `floor(q_i)` (rounded toward minus infinity, so a quota
   of -14.29 starts at -15).
5. The cents still missing, `total - sum(floor(q_i))`, are handed out one each
   to the parts with the largest fractional remainder `q_i - floor(q_i)`.
   **Equal remainders go to the lower index first.**

Guarantees: the parts add up to `total` exactly; every part differs from its
quota by less than one cent; a zero weight always gets exactly 0; the result
never contains `-0`.

Examples:

| total | weights | result |
|---|---|---|
| 10000 | 1, 1, 1 | 3334, 3333, 3333 |
| 100 | 0.5, 0.3, -0.1 | 71, 43, -14 |
| 0 | 2, 3 | 0, 0 |

## `applyOrderAdjustments(lines, { discount, shipping })`

`lines` is a list of `{ id, amount, weightKg }` where `amount` is the line
total in cents (negative for a returned item) and `weightKg` a weight as above.

- `discount` (cents, usually negative) is allocated across lines by `amount`.
- `shipping` (cents) is allocated across lines by `weightKg`. When every line
  weighs 0 (all digital goods), shipping is split equally, as if each line
  weighed 1.
- Either adjustment can be omitted or 0, which gives 0 shares.

Returns new line objects with `discountShare`, `shippingShare` and
`total = amount + discountShare + shippingShare`. The sum of the line totals
always equals sum(amount) + discount + shipping.
