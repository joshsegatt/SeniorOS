export function summarize(rows) {
  let totalPaid = 0;
  let totalInterest = 0;
  for (const row of rows) {
    totalPaid += row.payment;
    totalInterest += row.interest;
  }
  return {
    payments: rows.length,
    totalPaid,
    totalInterest,
    lastPayment: rows.length ? rows[rows.length - 1].payment : 0,
  };
}
