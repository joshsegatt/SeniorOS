const PRIORITY_LABEL = { high: 'High', normal: 'Normal', low: 'Low' };

/** One line for notification emails: "[T-1041] High: Lid cracked on arrival". @param {{ id: string, priority: string, subject: string }} ticket */
export function ticketLine(ticket) {
  return `[${ticket.id}] ${PRIORITY_LABEL[ticket.priority] ?? ticket.priority}: ${ticket.subject}`;
}

/** Hours between two ISO timestamps, rounded down. @param {string} from @param {Date} to */
export function hoursSince(from, to) {
  return Math.floor((to.getTime() - Date.parse(from)) / 3_600_000);
}
