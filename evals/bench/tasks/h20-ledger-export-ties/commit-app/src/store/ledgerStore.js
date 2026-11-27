// In-memory ledger store. Rows are kept in insertion (statement) order and
// every row gets a monotonically increasing `seq` when it is inserted.

export function createLedgerStore() {
  const rows = [];
  let seq = 0;

  return {
    insert(tx) {
      if (!tx || typeof tx.id !== 'string' || !tx.id) throw new TypeError('transaction needs an id');
      if (!Number.isInteger(tx.bookedAt)) throw new TypeError(`transaction ${tx.id}: bookedAt must be epoch seconds`);
      if (!Number.isInteger(tx.amountCents)) throw new TypeError(`transaction ${tx.id}: amountCents must be an integer`);
      if (typeof tx.accountId !== 'string' || !tx.accountId) throw new TypeError(`transaction ${tx.id}: accountId missing`);
      const row = Object.freeze({ ...tx, seq: ++seq });
      rows.push(row);
      return row;
    },

    count() {
      return rows.length;
    },

    /** Raw rows in insertion order. Debug/admin use only: readers should page with scan(). */
    all() {
      return rows.slice();
    },

    /**
     * Ordered range scan used by every paginated reader.
     *   order:     'asc' | 'desc' by booking time
     *   after:     a position from decodeCursor(); only rows strictly past it are returned
     *   limit:     max rows returned
     *   accountId: optional filter
     */
    scan({ order = 'asc', after = null, limit = 50, accountId = null } = {}) {
      if (order !== 'asc' && order !== 'desc') throw new RangeError(`unknown order "${order}"`);
      const dir = order === 'asc' ? 1 : -1;
      let out = accountId ? rows.filter((r) => r.accountId === accountId) : rows.slice();
      out.sort((a, b) => dir * (a.bookedAt - b.bookedAt));
      if (after) out = out.filter((r) => dir * (r.bookedAt - after.bookedAt) > 0);
      return out.slice(0, limit);
    },
  };
}
