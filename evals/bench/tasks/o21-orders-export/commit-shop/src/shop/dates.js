/**
 * The instants bounding a calendar month (UTC, which is what the shop platform uses).
 * @param {string} month 'YYYY-MM'
 * @returns {{ from: string, to: string }} from inclusive, to exclusive
 */
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`invalid month ${month}`);
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() };
}
