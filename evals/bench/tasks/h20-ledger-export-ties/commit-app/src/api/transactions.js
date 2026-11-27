import { formatCents, isoDate } from '../format/money.js';
import { fetchPage } from '../lib/paginate.js';

// GET /transactions?limit=&cursor=&order=&account=
// Newest first by default. See docs/api.md.

function toJson(tx) {
  return {
    id: tx.id,
    bookedAt: isoDate(tx.bookedAt),
    account: tx.accountId,
    amount: formatCents(tx.amountCents),
    memo: tx.memo,
  };
}

export function listTransactions(store, query = {}) {
  const limit = query.limit == null ? 25 : Number(query.limit);
  const order = query.order ?? 'desc';
  const { items, nextCursor } = fetchPage(store, {
    cursor: query.cursor ?? null,
    limit,
    order,
    accountId: query.account ?? null,
  });
  return { data: items.map(toJson), next: nextCursor };
}
