const ACTIVE = new Set(['open', 'pending']);

/**
 * Runs when an agent leaves the team: takes them off every open or pending ticket. A ticket nobody is left on goes
 * back to the triage queue. Solved and closed tickets keep their history. Returns the ids of the changed tickets.
 * @param {ReturnType<import('../tickets/store.js').createTicketStore>} store
 * @param {string} agentId
 * @param {() => Date} [now]
 */
export function offboardAgent(store, agentId, now = () => new Date()) {
  const changed = [];
  for (const t of store.all()) {
    if (!ACTIVE.has(t.status) || !t.assignees.includes(agentId)) continue;
    store.update(t.id, { assignees: t.assignees.filter((a) => a !== agentId), updatedAt: now().toISOString() });
    changed.push(t.id);
  }
  return changed.sort();
}
