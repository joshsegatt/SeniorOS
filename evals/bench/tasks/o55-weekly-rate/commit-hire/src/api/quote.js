import { getItem } from '../hire/catalog.js';
import { quote } from '../hire/pricing.js';
import { isAvailable } from '../hire/availability.js';
import { formatChf, invoiceLines } from '../hire/invoice.js';

/**
 * GET /v1/quote?item=exc-8t&from=2026-03-02&to=2026-03-11&waiver=1
 * @param {{ query: Record<string, string | undefined> }} req
 * @param {{ itemId: string, pickupDay: string, returnDay: string, status: string }[]} bookings
 */
export function handleQuote(req, bookings) {
  const { item: itemId, from, to, waiver } = req.query;
  if (!itemId || !from || !to) return { status: 400, body: { error: 'item, from and to are required' } };
  let item;
  try {
    item = getItem(itemId);
  } catch {
    return { status: 404, body: { error: `unknown item: ${itemId}` } };
  }
  try {
    const q = quote(item, from, to, { damageWaiver: waiver === '1' });
    const invoice = invoiceLines(item, q);
    return {
      status: 200,
      body: { ...q, available: isAvailable(bookings, item.id, from, to), total: formatChf(q.totalCents), deposit: formatChf(q.depositCents), lines: invoice.lines },
    };
  } catch (err) {
    return { status: 422, body: { error: err.message } };
  }
}
