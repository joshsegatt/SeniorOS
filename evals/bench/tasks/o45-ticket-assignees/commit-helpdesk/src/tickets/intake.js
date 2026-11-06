/**
 * @typedef {{ keyword: string, agent: string }} RoutingRule
 * The first rule whose keyword appears in the subject or body (any case) assigns the new ticket to its agent.
 */

/**
 * Creates a ticket from a customer email.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {{ from: string, subject: string, body?: string }} email
 * @param {RoutingRule[]} [rules]
 * @param {() => Date} [now]
 */
export function createFromEmail(store, email, rules = [], now = () => new Date()) {
  const subject = email.subject.trim() || '(no subject)';
  const text = `${subject}\n${email.body ?? ''}`.toLowerCase();
  const rule = rules.find((r) => text.includes(r.keyword.toLowerCase()));
  const at = now().toISOString();
  return store.insert({
    id: store.nextId(),
    subject,
    requester: email.from.trim().toLowerCase(),
    status: 'open',
    priority: /\burgent\b/i.test(subject) ? 'high' : 'normal',
    assignee: rule ? rule.agent : null,
    createdAt: at,
    updatedAt: at,
    firstResponseAt: null,
    escalatedAt: null,
    tags: [],
  });
}
