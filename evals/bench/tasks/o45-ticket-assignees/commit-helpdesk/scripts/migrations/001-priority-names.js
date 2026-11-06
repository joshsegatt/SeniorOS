// Version 1 (March 2026): priority used to be saved as a number (1 = high, 2 = normal, 3 = low).
export const version = 1;

const NAMES = { 1: 'high', 2: 'normal', 3: 'low' };

/** Upgrades one ticket saved before this version. @param {Record<string, any>} ticket */
export function up(ticket) {
  if (typeof ticket.priority !== 'number') return ticket;
  return { ...ticket, priority: NAMES[ticket.priority] ?? 'normal' };
}
