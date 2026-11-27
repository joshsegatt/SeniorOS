import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncContacts, CONTACTS_KEY } from '../../src/sync.js';
import { MemoryStore } from '../../src/store.js';
import { runNightly } from '../../src/job.js';

// Deterministic PRNG so every interleaving is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Yield to the microtask queue n times: a deterministic "latency".
async function yields(n) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

function contact(id, updatedAt, extra = {}) {
  return { id, name: `Name ${id}`, email: `${id}@example.com`, updatedAt, ...extra };
}

// Remote with explicit pages and a seeded, deterministic completion order.
function seededRemote(pages, rand) {
  return {
    listPages: async () => {
      await yields(Math.floor(rand() * 5));
      return pages.map((_, i) => i);
    },
    fetchPage: async (page) => {
      await yields(Math.floor(rand() * 40));
      return structuredClone(pages[page]);
    },
  };
}

function seededStore(rand) {
  return new MemoryStore({ latency: () => yields(Math.floor(rand() * 40)) });
}

function buildPages(pageCount, perPage) {
  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    const page = [];
    for (let i = 0; i < perPage; i++) page.push(contact(`p${p}-${i}`, '2026-11-20T00:00:00.000Z'));
    pages.push(page);
  }
  return pages;
}

test('no record is lost and the run is persisted when syncContacts resolves (80 interleavings)', async () => {
  for (let seed = 1; seed <= 80; seed++) {
    const rand = mulberry32(seed);
    const pages = buildPages(6, 7);
    const store = seededStore(rand);
    const result = await syncContacts({ remote: seededRemote(pages, rand), store });

    const doc = (await store.load(CONTACTS_KEY)) ?? {};
    const expected = pages.flat().map((c) => c.id).sort();
    assert.deepEqual(Object.keys(doc).sort(), expected, `seed ${seed}: records lost`);
    assert.equal(result.pages, 6, `seed ${seed}: pages`);
    assert.equal(result.fetched, 42, `seed ${seed}: fetched`);
  }
});

test('existing contacts are kept and the latest version wins, whatever the order (60 interleavings)', async () => {
  for (let seed = 101; seed <= 160; seed++) {
    const rand = mulberry32(seed);
    const store = seededStore(rand);
    await store.save(CONTACTS_KEY, {
      keep1: contact('keep1', '2026-01-01T00:00:00.000Z'),
      upd: contact('upd', '2026-01-01T00:00:00.000Z', { name: 'old' }),
      newerLocal: contact('newerLocal', '2026-12-01T00:00:00.000Z', { name: 'local' }),
    });
    const pages = buildPages(5, 4);
    pages[0].push(contact('upd', '2026-11-02T00:00:00.000Z', { name: 'fresh' }));
    pages[1].push(contact('newerLocal', '2026-11-02T00:00:00.000Z', { name: 'remote' }));
    // the same contact in two pages (moved during pagination): later updatedAt wins
    pages[2].push(contact('moved', '2026-11-05T00:00:00.000Z', { name: 'latest' }));
    pages[4].push(contact('moved', '2026-11-03T00:00:00.000Z', { name: 'stale' }));

    await syncContacts({ remote: seededRemote(pages, rand), store });
    const doc = (await store.load(CONTACTS_KEY)) ?? {};

    for (const c of pages.flat()) assert.ok(doc[c.id], `seed ${seed}: lost ${c.id}`);
    assert.ok(doc.keep1, `seed ${seed}: existing contact deleted`);
    assert.equal(doc.upd?.name, 'fresh', `seed ${seed}: update lost`);
    assert.equal(doc.newerLocal?.name, 'local', `seed ${seed}: newer local version overwritten`);
    assert.equal(doc.moved?.name, 'latest', `seed ${seed}: stale duplicate won`);
    assert.equal(Object.keys(doc).length, 5 * 4 + 4, `seed ${seed}: count`);
  }
});

test('timer-based latency like the production store (10 runs)', async () => {
  for (let seed = 201; seed <= 210; seed++) {
    const rand = mulberry32(seed);
    const pages = buildPages(5, 10);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const remote = {
      listPages: async () => pages.map((_, i) => i),
      fetchPage: async (p) => {
        await sleep(Math.floor(rand() * 4));
        return structuredClone(pages[p]);
      },
    };
    const store = new MemoryStore({ latency: () => sleep(Math.floor(rand() * 4)) });
    await syncContacts({ remote, store });
    const doc = (await store.load(CONTACTS_KEY)) ?? {};
    assert.equal(Object.keys(doc).length, 50, `seed ${seed}: records lost`);
  }
});

test('runNightly records the run only after every contact is persisted', async () => {
  for (let seed = 301; seed <= 320; seed++) {
    const rand = mulberry32(seed);
    const pages = buildPages(4, 5);
    const store = seededStore(rand);
    await runNightly({ remote: seededRemote(pages, rand), store, log: () => {} });
    const doc = (await store.load(CONTACTS_KEY)) ?? {};
    const lastRun = await store.load('sync:lastRun');
    assert.equal(Object.keys(doc).length, 20, `seed ${seed}: records lost`);
    assert.equal(lastRun?.fetched, 20, `seed ${seed}: lastRun.fetched`);
  }
});

test('a failing page makes syncContacts reject', async () => {
  const rand = mulberry32(7);
  const pages = buildPages(3, 2);
  const remote = seededRemote(pages, rand);
  const failing = {
    listPages: remote.listPages,
    fetchPage: async (p) => {
      if (p === 1) {
        await yields(3);
        throw new Error('CRM 503');
      }
      return remote.fetchPage(p);
    },
  };
  await assert.rejects(syncContacts({ remote: failing, store: seededStore(rand) }), /CRM 503/);
});
