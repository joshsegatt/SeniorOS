const ACTIVE = new Set(['open', 'pending']);

/**
 * The workload dashboard: for each agent, how many tickets are in their inbox (open or pending tickets assigned
 * to them), plus `unassigned`, the size of the triage queue. Agents with no tickets are left out.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 */
export function workload(store) {
  /** @type {Record<string, number>} */
  const counts = { unassigned: 0 };
  for (const t of store.all()) {
    if (!ACTIVE.has(t.status)) continue;
    if (t.assignees.length === 0) counts.unassigned += 1;
    for (const agent of t.assignees) counts[agent] = (counts[agent] ?? 0) + 1;
  }
  return counts;
}
