// Version 2 (November 2026): a ticket can have several assignees. `assignee` (one agent id or null) became
// `assignees`, a list of agent ids (empty when nobody is assigned).
export const version = 2;

/** Upgrades one ticket saved before this version. @param {Record<string, any>} ticket */
export function up(ticket) {
  if (Array.isArray(ticket.assignees)) return ticket;
  const { assignee, ...rest } = ticket;
  return { ...rest, assignees: assignee ? [assignee] : [] };
}
