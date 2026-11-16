/**
 * In-memory ledger (production uses the same interface over Postgres).
 * @typedef {{ id: string, date: string, description: string, amountCents: number, currency: string, category: string, source: string }} Transaction
 */
export function createLedger() {
  /** @type {Transaction[]} */
  const rows = [];
  let seq = 0;
  return {
    /** @param {Omit<Transaction, 'id'>} tx */
    insert(tx) {
      seq += 1;
      const row = { id: `t-${seq}`, ...tx };
      rows.push(row);
      return { ...row };
    },
    /** Transactions in the order they were added. */
    transactions() {
      return rows.map((r) => ({ ...r }));
    },
  };
}
