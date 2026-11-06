import { isAgent } from './agents.js';

const DONE = new Set(['solved', 'closed']);

/**
 * Adds an agent to a ticket's assignees (nothing changes if they are already on it).
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
  if (ticket.assignees.includes(agentId)) return ticket;
  return store.update(id, { assignees: [...ticket.assignees, agentId], updatedAt: now().toISOString() });
}

/**
 * Takes an agent off a ticket. A ticket nobody is left on goes back to the triage queue.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {string} id
 * @param {string} agentId
 * @param {() => Date} [now]
 */
export function unassignTicket(store, id, agentId, now = () => new Date()) {
  const ticket = store.get(id);
  if (!ticket) throw new Error(`unknown ticket: ${id}`);
  if (!ticket.assignees.includes(agentId)) return ticket;
  return store.update(id, { assignees: ticket.assignees.filter((a) => a !== agentId), updatedAt: now().toISOString() });
}
