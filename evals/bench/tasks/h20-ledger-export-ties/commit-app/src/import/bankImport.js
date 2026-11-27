import { parseAmount } from '../format/money.js';

// Bank statements arrive as JSON lines. The bank books transactions in
// batches, so every line of a batch carries the batch's booking time.
// Line N (1-based, blank lines ignored) becomes transaction id `tx-N`.

export function parseStatement(text) {
  const out = [];
  let n = 0;
  for (const [i, raw] of String(text).split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    let line;
    try {
      line = JSON.parse(raw);
    } catch {
      throw new SyntaxError(`statement line ${i + 1}: invalid JSON`);
    }
    const ms = Date.parse(line.booked);
    if (Number.isNaN(ms)) throw new TypeError(`statement line ${i + 1}: invalid booked time`);
    n += 1;
    out.push({
      id: `tx-${n}`,
      bookedAt: Math.floor(ms / 1000),
      accountId: String(line.account),
      amountCents: parseAmount(line.amount),
      memo: String(line.memo ?? ''),
    });
  }
  return out;
}

export function importStatement(store, text) {
  const txs = parseStatement(text);
  for (const tx of txs) store.insert(tx);
  return txs.length;
}
