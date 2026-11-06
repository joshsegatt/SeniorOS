import { isAgent } from './agents.js';

// Tickets saved before multiple assignees have `assignee` instead of `assignees`.
const assigneesOf = (t) => t.assignees ?? (t.assignee ? [t.assignee] : []);

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
  const assignees = assigneesOf(ticket);
  if (assignees.includes(agentId)) return ticket;
  return store.update(id, { assignees: [...assignees, agentId], updatedAt: now().toISOString() });
}

export function unassignTicket(store, id, agentId, now = () => new Date()) {
  const ticket = store.get(id);
  if (!ticket) throw new Error(`unknown ticket: ${id}`);
  return store.update(id, { assignees: assigneesOf(ticket).filter((a) => a !== agentId), updatedAt: now().toISOString() });
}
