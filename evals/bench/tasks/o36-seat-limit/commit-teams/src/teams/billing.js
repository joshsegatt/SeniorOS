/** @typedef {ReturnType<import('./store.js').createTeamStore>} TeamStore */

/** @param {string} month "2026-10" */
function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must look like 2026-10');
  const [y, m] = month.split('-').map(Number);
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
}

/**
 * Seats on the monthly invoice: every member who held a seat at some point in the month
 * (no proration; pending invites are not billed).
 * @param {TeamStore} store
 * @param {string} workspaceId
 * @param {string} month "2026-10"
 */
export function billableSeats(store, workspaceId, month) {
  const { start, end } = monthRange(month);
  return store.membersOf(workspaceId).filter((m) => {
    if (!m.joinedAt || Date.parse(m.joinedAt) >= end) return false;
    return !m.removedAt || Date.parse(m.removedAt) >= start;
  }).length;
}

/** Invoice line for the month. @param {TeamStore} store @param {string} workspaceId @param {string} month @param {number} pricePerSeat */
export function seatInvoiceLine(store, workspaceId, month, pricePerSeat) {
  const quantity = billableSeats(store, workspaceId, month);
  return { description: `Seats (${month})`, quantity, unitPrice: pricePerSeat, total: Math.round(quantity * pricePerSeat * 100) / 100 };
}
