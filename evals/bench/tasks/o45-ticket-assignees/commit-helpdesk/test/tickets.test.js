import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketStore, openTicketStore } from '../src/tickets/store.js';
import { createFromEmail } from '../src/tickets/intake.js';
import { assignTicket } from '../src/tickets/assign.js';
import { inbox, triage } from '../src/tickets/inbox.js';
import { searchTickets } from '../src/tickets/search.js';
import { workload } from '../src/tickets/stats.js';
import { escalateOverdue } from '../src/jobs/escalate.js';
import { offboardAgent } from '../src/jobs/offboard.js';
import { ticketLine } from '../src/tickets/format.js';

const at = (iso) => () => new Date(iso);
const RULES = [{ keyword: 'refund', agent: 'marco' }];

function helpdesk() {
  const store = createTicketStore();
  const a = createFromEmail(store, { from: 'A@Example.test', subject: 'Where is my refund?' }, RULES, at('2026-11-05T08:00:00Z'));
  const b = createFromEmail(store, { from: 'b@example.test', subject: 'URGENT wrong item', body: 'sent a mug instead of a kettle' }, RULES, at('2026-11-05T09:00:00Z'));
  const c = createFromEmail(store, { from: 'c@example.test', subject: 'Gift wrap' }, RULES, at('2026-11-05T10:00:00Z'));
  return { store, a, b, c };
}

test('intake creates tickets and routes them', () => {
  const { store, a, b } = helpdesk();
  assert.equal(a.id, 'T-1001');
  assert.equal(a.requester, 'a@example.test');
  assert.equal(b.priority, 'high');
  assert.deepEqual(inbox(store, 'marco'), [a.id]);
  assert.deepEqual(triage(store), [b.id, 'T-1003']);
});

test('assigning moves a ticket out of triage into the inbox', () => {
  const { store, b, c } = helpdesk();
  assignTicket(store, c.id, 'priya', at('2026-11-05T11:00:00Z'));
  assignTicket(store, b.id, 'priya', at('2026-11-05T11:01:00Z'));
  assert.deepEqual(inbox(store, 'priya'), [b.id, c.id]);
  assert.deepEqual(triage(store), []);
  assert.throws(() => assignTicket(store, c.id, 'nobody'), /unknown agent/);
  store.update(c.id, { status: 'solved' });
  assert.throws(() => assignTicket(store, c.id, 'tomas'), /is solved/);
  assert.deepEqual(inbox(store, 'priya'), [b.id]);
});

test('search and workload', () => {
  const { store, b } = helpdesk();
  assignTicket(store, b.id, 'tomas');
  assert.deepEqual(searchTickets(store, 'assignee:marco'), ['T-1001']);
  assert.deepEqual(searchTickets(store, 'assignee:none'), ['T-1003']);
  assert.deepEqual(searchTickets(store, 'priority:high wrong'), [b.id]);
  assert.deepEqual(workload(store), { marco: 1, tomas: 1, unassigned: 1 });
});

test('overdue tickets are escalated once', () => {
  const { store, a, b } = helpdesk();
  const sent = [];
  const notify = (agentId, ticket) => sent.push(`${agentId} ${ticketLine(ticket)}`);
  assert.deepEqual(escalateOverdue(store, new Date('2026-11-05T13:30:00Z'), notify), [b.id]);
  assert.deepEqual(sent, ['lena [T-1002] High: URGENT wrong item']);
  assert.deepEqual(escalateOverdue(store, new Date('2026-11-06T11:00:00Z'), notify), [a.id, 'T-1003']);
  assert.deepEqual(sent.slice(1), ['marco [T-1001] Normal: Where is my refund?', 'lena [T-1003] Normal: Gift wrap']);
  assert.deepEqual(escalateOverdue(store, new Date('2026-11-07T09:00:00Z'), notify), []);
});

test('offboarding sends the agent\'s tickets back to triage', () => {
  const { store, a } = helpdesk();
  assert.deepEqual(offboardAgent(store, 'marco', at('2026-11-06T09:00:00Z')), [a.id]);
  assert.deepEqual(inbox(store, 'marco'), []);
  assert.deepEqual(triage(store), [a.id, 'T-1002', 'T-1003']);
});

test('the saved tickets load', () => {
  const store = openTicketStore();
  assert.equal(store.all().length, 8);
  assert.deepEqual(inbox(store, 'lena'), ['T-1041', 'T-1043']);
  assert.deepEqual(triage(store), ['T-1044', 'T-1046']);
  assert.equal(store.nextId(), 'T-1049');
});

test('old numeric priorities are migrated when tickets are opened', () => {
  const store = createTicketStore({ schemaVersion: 0, tickets: [{ id: 'T-900', subject: 'Old', requester: 'x@example.test', status: 'open', priority: 1, assignee: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', firstResponseAt: null, escalatedAt: null, tags: [] }] });
  assert.equal(store.get('T-900').priority, 'high');
});
