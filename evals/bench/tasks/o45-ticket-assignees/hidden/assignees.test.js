import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTicketStore, openTicketStore } from '../../src/tickets/store.js';
import { createFromEmail } from '../../src/tickets/intake.js';
import { assignTicket, unassignTicket } from '../../src/tickets/assign.js';
import { inbox, triage } from '../../src/tickets/inbox.js';
import { searchTickets } from '../../src/tickets/search.js';
import { workload } from '../../src/tickets/stats.js';
import { escalateOverdue } from '../../src/jobs/escalate.js';
import { offboardAgent } from '../../src/jobs/offboard.js';

const at = (iso) => () => new Date(iso);
const RULES = [{ keyword: 'refund', agent: 'marco' }];

const ticket = (id, fields) => ({ id, subject: `Ticket ${id}`, requester: `${id.toLowerCase()}@example.test`, status: 'open', priority: 'normal', assignee: null, createdAt: '2026-11-05T08:00:00Z', updatedAt: '2026-11-05T08:00:00Z', firstResponseAt: null, escalatedAt: null, tags: [], ...fields });

// Tickets as they were saved before this change (schemaVersion 1, one `assignee`).
const oldDoc = () => ({
  schemaVersion: 1,
  tickets: [
    ticket('T-2001', { assignee: 'lena', subject: 'Lid cracked' }),
    ticket('T-2002', { priority: 'high', createdAt: '2026-11-05T09:00:00Z' }),
    ticket('T-2003', { status: 'pending', priority: 'low', assignee: 'marco', createdAt: '2026-11-03T12:00:00Z' }),
    ticket('T-2004', { assignee: 'marco', createdAt: '2026-11-04T10:00:00Z', firstResponseAt: '2026-11-04T10:30:00Z' }),
    ticket('T-2005', { status: 'solved', assignee: 'lena', createdAt: '2026-11-01T10:00:00Z' }),
  ],
});

const notifications = () => {
  const sent = [];
  return { sent, notify: (agentId, t) => sent.push(`${agentId} ${t.id}`) };
};

test('tickets saved with one assignee still show everywhere', () => {
  const store = createTicketStore(oldDoc());
  assert.deepEqual(inbox(store, 'lena'), ['T-2001']);
  assert.deepEqual(inbox(store, 'marco'), ['T-2004', 'T-2003']);
  assert.deepEqual(triage(store), ['T-2002']);
  assert.deepEqual(workload(store), { lena: 1, marco: 2, unassigned: 1 });
  assert.deepEqual(searchTickets(store, 'assignee:lena'), ['T-2001', 'T-2005']);
  assert.deepEqual(searchTickets(store, 'assignee:none'), ['T-2002']);
});

test('a second agent can be added to an old ticket', () => {
  const store = createTicketStore(oldDoc());
  assignTicket(store, 'T-2001', 'marco', at('2026-11-05T10:00:00Z'));
  assignTicket(store, 'T-2001', 'marco', at('2026-11-05T10:01:00Z'));
  assert.deepEqual(inbox(store, 'lena'), ['T-2001']);
  assert.deepEqual(inbox(store, 'marco'), ['T-2004', 'T-2001', 'T-2003']);
  assert.deepEqual(workload(store), { lena: 1, marco: 3, unassigned: 1 });
  assert.deepEqual(searchTickets(store, 'assignee:lena'), ['T-2001', 'T-2005']);
  assert.deepEqual(searchTickets(store, 'assignee:marco'), ['T-2001', 'T-2003', 'T-2004']);
  assert.deepEqual(triage(store), ['T-2002']);
});

test('unassigning the only agent sends a ticket back to triage', () => {
  const store = createTicketStore(oldDoc());
  unassignTicket(store, 'T-2001', 'lena', at('2026-11-05T10:00:00Z'));
  assert.deepEqual(inbox(store, 'lena'), []);
  assert.deepEqual(triage(store), ['T-2001', 'T-2002']);
  assert.deepEqual(searchTickets(store, 'assignee:none'), ['T-2001', 'T-2002']);
  assert.deepEqual(workload(store), { marco: 2, unassigned: 2 });
  assignTicket(store, 'T-2004', 'priya', at('2026-11-05T10:05:00Z'));
  unassignTicket(store, 'T-2004', 'marco', at('2026-11-05T10:06:00Z'));
  assert.deepEqual(inbox(store, 'priya'), ['T-2004']);
  assert.deepEqual(inbox(store, 'marco'), ['T-2003']);
});

test('tickets from email intake work with every reader', () => {
  const store = createTicketStore(oldDoc());
  const routed = createFromEmail(store, { from: 'a@example.test', subject: 'Refund please' }, RULES, at('2026-11-05T11:00:00Z'));
  const free = createFromEmail(store, { from: 'b@example.test', subject: 'Gift wrap' }, RULES, at('2026-11-05T11:30:00Z'));
  assert.deepEqual(inbox(store, 'marco'), ['T-2004', routed.id, 'T-2003']);
  assert.deepEqual(triage(store), ['T-2002', free.id]);
  assert.deepEqual(searchTickets(store, 'assignee:marco refund'), [routed.id]);
  assert.deepEqual(searchTickets(store, 'assignee:none'), ['T-2002', free.id]);
  assignTicket(store, routed.id, 'priya');
  assert.deepEqual(workload(store), { lena: 1, marco: 3, priya: 1, unassigned: 2 });
  const { sent, notify } = notifications();
  escalateOverdue(store, new Date('2026-11-06T12:00:00Z'), notify);
  assert.deepEqual(sent.filter((s) => s.endsWith(routed.id) || s.endsWith(free.id)).sort(), [`lena ${free.id}`, `marco ${routed.id}`, `priya ${routed.id}`]);
});

test('escalations notify every assignee, or the lead when there is none', () => {
  const store = createTicketStore(oldDoc());
  assignTicket(store, 'T-2001', 'priya', at('2026-11-05T10:00:00Z'));
  const { sent, notify } = notifications();
  assert.deepEqual(escalateOverdue(store, new Date('2026-11-06T09:00:00Z'), notify), ['T-2001', 'T-2002']);
  assert.deepEqual(sent.sort(), ['lena T-2001', 'lena T-2002', 'priya T-2001']);

  const untouched = createTicketStore(oldDoc());
  const second = notifications();
  escalateOverdue(untouched, new Date('2026-11-06T09:00:00Z'), second.notify);
  assert.deepEqual(second.sent.sort(), ['lena T-2001', 'lena T-2002']);
});

test('offboarding takes the agent off shared and old tickets', () => {
  const store = createTicketStore(oldDoc());
  assignTicket(store, 'T-2004', 'priya', at('2026-11-05T10:00:00Z'));
  assert.deepEqual(offboardAgent(store, 'marco', at('2026-11-06T09:00:00Z')), ['T-2003', 'T-2004']);
  assert.deepEqual(inbox(store, 'marco'), []);
  assert.deepEqual(inbox(store, 'priya'), ['T-2004']);
  assert.deepEqual(triage(store), ['T-2003', 'T-2002']);
  assert.deepEqual(workload(store), { lena: 1, priya: 1, unassigned: 2 });
  assert.deepEqual(searchTickets(store, 'assignee:marco'), []);
});

test('the saved tickets in data/tickets.json survive an edit, a save and a reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tickets-'));
  try {
    const file = join(dir, 'tickets.json');
    copyFileSync(new URL('../../data/tickets.json', import.meta.url), file);
    const store = openTicketStore(file);
    assert.deepEqual(inbox(store, 'lena'), ['T-1041', 'T-1043']);
    assert.deepEqual(inbox(store, 'marco'), ['T-1042', 'T-1047']);
    assert.deepEqual(triage(store), ['T-1044', 'T-1046']);
    assert.deepEqual(workload(store), { lena: 2, marco: 2, unassigned: 2 });
    assert.deepEqual(searchTickets(store, 'assignee:lena'), ['T-1041', 'T-1043', 'T-1048']);
    assignTicket(store, 'T-1046', 'marco', at('2026-11-05T08:00:00Z'));
    assignTicket(store, 'T-1046', 'priya', at('2026-11-05T08:01:00Z'));
    store.save();

    const reopened = openTicketStore(file);
    assert.deepEqual(inbox(reopened, 'marco'), ['T-1046', 'T-1042', 'T-1047']);
    assert.deepEqual(inbox(reopened, 'priya'), ['T-1046']);
    assert.deepEqual(triage(reopened), ['T-1044']);
    assert.deepEqual(workload(reopened), { lena: 2, marco: 3, priya: 1, unassigned: 1 });
    const { sent, notify } = notifications();
    assert.deepEqual(escalateOverdue(reopened, new Date('2026-11-06T12:00:00Z'), notify), ['T-1042', 'T-1044', 'T-1046']);
    assert.deepEqual(sent.sort(), ['lena T-1044', 'marco T-1042', 'marco T-1046', 'priya T-1046']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tickets saved before the priority migration still open', () => {
  const store = createTicketStore({ schemaVersion: 0, tickets: [ticket('T-900', { priority: 1, assignee: 'tomas' }), ticket('T-901', { priority: 3 })] });
  assert.deepEqual(inbox(store, 'tomas'), ['T-900']);
  assert.equal(store.get('T-900').priority, 'high');
  assert.deepEqual(triage(store), ['T-901']);
  assert.deepEqual(workload(store), { tomas: 1, unassigned: 1 });
});
