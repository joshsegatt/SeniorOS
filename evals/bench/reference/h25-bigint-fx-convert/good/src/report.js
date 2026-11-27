// Total of mixed-currency balances, expressed in `target`: one rounding per currency.
export function totalIn(target, balances, table) {
  const sums = new Map();
  for (const { currency, amount } of balances) {
    if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
    sums.set(currency, (sums.get(currency) ?? 0n) + amount);
  }
  let total = 0n;
  for (const [currency, sum] of sums) total += table.convert(sum, currency, target);
  return total;
}
