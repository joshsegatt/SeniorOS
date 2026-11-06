import { TEAM_LEAD } from '../tickets/agents.js';
import { hoursSince } from '../tickets/format.js';

// Hours a customer may wait for the first answer, by priority.
export const SLA_HOURS = { high: 4, normal: 24, low: 72 };

/**
 * Runs every 15 minutes. An open ticket still waiting for its first answer past its SLA is escalated once: the
 * people working on it (its assignee) are notified, or the team lead when nobody is assigned.
 * @param {ReturnType<import('../tickets/store.js').createTicketStore>} store
 * @param {Date} now
 * @param {(agentId: string, ticket: import('../tickets/store.js').Ticket) => void} notify
 */
export function escalateOverdue(store, now, notify) {
  const escalated = [];
  for (const t of store.all()) {
    if (t.status !== 'open' || t.firstResponseAt || t.escalatedAt) continue;
    if (hoursSince(t.createdAt, now) < SLA_HOURS[t.priority]) continue;
    notify(t.assignee ?? TEAM_LEAD, t);
    store.update(t.id, { escalatedAt: now.toISOString() });
    escalated.push(t.id);
  }
  return escalated.sort();
}
