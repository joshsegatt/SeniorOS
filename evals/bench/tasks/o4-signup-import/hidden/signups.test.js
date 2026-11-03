import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createCustomerStore } from '../../src/crm/customers.js';
import { importSignups } from '../../src/crm/signups.js';

const customers = () => [
  { id: 'cu-1', email: 'Ada@Example.com', name: 'Ada', kind: 'customer', newsletter: false },
  { id: 'cu-2', email: 'bob@example.com', name: 'Bob', kind: 'customer', newsletter: false },
  { id: 'cu-3', email: 'cy@example.com', name: 'Cy', kind: 'customer', newsletter: false },
];

test('matching customers get the newsletter flag, unknown emails become leads', async () => {
  const store = createCustomerStore(customers());
  const csv = 'email,name,signed_up_at\n ada@example.COM ,Ada,2026-10-01T08:00:00Z\nnew@mailbox.org,Nora Reader,2026-10-01T09:00:00Z\nbob@example.com,Bob,2026-10-02T09:00:00Z\n';
  const result = await importSignups(csv, store);
  assert.equal(result.subscribed, 2);
  assert.equal(result.added, 1);
  assert.equal(store.findByEmail('ada@example.com')?.newsletter, true);
  assert.equal(store.findByEmail('ada@example.com')?.kind, 'customer');
  assert.equal(store.findByEmail('bob@example.com')?.newsletter, true);
  assert.equal(store.findByEmail('cy@example.com')?.newsletter, false);
  const lead = store.findByEmail('NEW@mailbox.org');
  assert.equal(lead?.kind, 'lead');
  assert.equal(lead?.newsletter, true);
  assert.equal(lead?.name, 'Nora Reader');
  assert.equal(store.size, 4);
});

test('the sample export imports', async () => {
  const csv = readFileSync(new URL('../../data/signups-sample.csv', import.meta.url), 'utf8');
  const { demoCustomers } = await import('../../src/crm/seed.js');
  const store = createCustomerStore(demoCustomers(100).map((c) => ({ ...c, newsletter: false })));
  const result = await importSignups(csv, store);
  assert.equal(result.subscribed, 4);
  assert.equal(result.added, 3);
  assert.equal(store.findByEmail('pat.ng@mailbox.org')?.kind, 'lead');
});

test('the same new email twice in one export makes one lead', async () => {
  const store = createCustomerStore(customers());
  const csv = 'email,name,signed_up_at\nlee@post.ch,Lee,2026-10-01T08:00:00Z\nLEE@post.ch,Lee Sun,2026-10-03T08:00:00Z\n';
  await importSignups(csv, store);
  assert.equal(store.all().filter((c) => c.email.toLowerCase() === 'lee@post.ch').length, 1);
  assert.equal(store.size, 4);
});

test('an export the size of production imports in seconds', () => {
  const customersUrl = new URL('../../src/crm/customers.js', import.meta.url).href;
  const signupsUrl = new URL('../../src/crm/signups.js', import.meta.url).href;
  const seedUrl = new URL('../../src/crm/seed.js', import.meta.url).href;
  const script = `
    const { createCustomerStore } = await import(${JSON.stringify(customersUrl)});
    const { importSignups } = await import(${JSON.stringify(signupsUrl)});
    const { demoCustomers } = await import(${JSON.stringify(seedUrl)});
    const rows = demoCustomers(24000).map((c) => ({ ...c, newsletter: false }));
    const store = createCustomerStore(rows);
    const lines = ['email,name,signed_up_at'];
    for (let i = 0; i < 24000; i += 1) {
      if (i % 2 === 0) lines.push(rows[i].email.toUpperCase() + ',' + rows[i].name + ',2026-10-01T08:00:00Z');
      else lines.push('reader' + i + '@mailbox.org,Reader ' + i + ',2026-10-01T08:00:00Z');
    }
    const started = Date.now();
    const result = await importSignups(lines.join('\\n') + '\\n', store);
    process.stdout.write(JSON.stringify({ ...result, size: store.size, ms: Date.now() - started,
      flagged: store.findByEmail(rows[2].email).newsletter, lead: store.findByEmail('reader23999@mailbox.org')?.kind }));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 3000 });
  assert.ok(!run.error && run.signal === null, `24k-row import did not finish within 3 s (killed: ${run.signal ?? run.error?.message})`);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.equal(out.subscribed, 12000);
  assert.equal(out.added, 12000);
  assert.equal(out.size, 36000);
  assert.equal(out.flagged, true);
  assert.equal(out.lead, 'lead');
});
