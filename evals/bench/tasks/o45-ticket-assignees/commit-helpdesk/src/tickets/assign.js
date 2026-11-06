import { isAgent } from './agents.js';

const DONE = new Set(['solved', 'closed']);

/**
 * Assigns a ticket to an agent.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {string} id
 * @param {string} agentId
 * @param {() => Date} [now]
 */
export function assignTicket(store, id, agentId, now = () => new Date()) {
  const ticket = store.get(id);
  if (!ticket) throw new Error(`unknown ticket: ${id}`);
  if (DONE.has(ticket.status)) throw new Error(`ticket ${id} is ${ticket.status}`);
  if (!isAgent(agentId)) throw new Error(`unknown agent: ${agentId}`);
  return store.update(id, { assignee: agentId, updatedAt: now().toISOString() });
}
