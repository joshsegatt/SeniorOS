/**
 * The helpdesk search box. Filters: `assignee:<agent>` (tickets assigned to that agent), `assignee:none`
 * (tickets nobody is assigned to), `status:<status>`, `priority:<priority>`, `tag:<tag>`. Every other word must
 * appear in the subject (any case). All statuses are searched unless `status:` is given. Returns ticket ids, sorted.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {string} query
 */
export function searchTickets(store, query) {
  const filters = [];
  const words = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const [key, value] = token.includes(':') ? token.split(':', 2) : [null, token];
    if (key === 'assignee') filters.push((t) => (value === 'none' ? t.assignees.length === 0 : t.assignees.includes(value)));
    else if (key === 'status') filters.push((t) => t.status === value);
    else if (key === 'priority') filters.push((t) => t.priority === value);
    else if (key === 'tag') filters.push((t) => t.tags.includes(value));
    else words.push(token.toLowerCase());
  }
  return store
    .all()
    .filter((t) => filters.every((f) => f(t)) && words.every((w) => t.subject.toLowerCase().includes(w)))
    .map((t) => t.id)
    .sort();
}
