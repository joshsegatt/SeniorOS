const TYPES = new Set(['sale', 'refund']);

/** In-memory ledger. `scanCount` counts aggregations (the expensive query in production). */
export function createLedger() {
  const rows = [];
  let scans = 0;

  return {
    append(row) {
      if (!row.storeId || !/^\d{4}-\d{2}-\d{2}$/.test(row.day ?? '')) throw new TypeError('row needs storeId and day');
      if (!TYPES.has(row.type)) throw new TypeError(`unknown row type ${row.type}`);
      if (!Number.isInteger(row.amountCents) || row.amountCents < 0) throw new RangeError('amountCents must be >= 0');
      rows.push({ ...row });
    },
    scan(storeId, day) {
      scans += 1;
      return rows.filter((row) => row.storeId === storeId && row.day === day).map((row) => ({ ...row }));
    },
    get scanCount() {
      return scans;
    },
  };
}
