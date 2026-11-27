// Total of mixed-currency balances, expressed in `target`.
export function totalIn(target, balances, table) {
  let total = 0n;
  for (const { currency, amount } of balances) {
    total += table.convert(amount, currency, target);
  }
  return total;
}
