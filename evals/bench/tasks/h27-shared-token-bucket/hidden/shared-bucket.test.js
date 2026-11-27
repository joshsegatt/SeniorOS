import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../src/index.js';

// ---------------------------------------------------------------- harness

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Implements the documented store interface the way a network store behaves:
// every operation takes a (seeded, random) number of event-loop turns, so
// operations from different callers interleave. compareAndSet is atomic.
class NetworkStore {
  #data = new Map();
  #random;
  pending = 0;

  constructor(seed) {
    this.#random = rng(seed);
  }

  async #latency() {
    const turns = Math.floor(this.#random() * 4);
    for (let i = 0; i < turns; i++) await tick();
  }

  async #op(fn) {
    this.pending++;
    try {
      await this.#latency();
      const result = fn();
      await this.#latency();
      return result;
    } finally {
      this.pending--;
    }
  }

  get(key) {
    return this.#op(() => (this.#data.has(key) ? this.#data.get(key) : null));
  }

  set(key, value) {
    return this.#op(() => {
      this.#data.set(key, value);
    });
  }

  compareAndSet(key, expected, next) {
    return this.#op(() => {
      const current = this.#data.has(key) ? this.#data.get(key) : null;
      if (current !== expected) return false;
      this.#data.set(key, next);
      return true;
    });
  }

  delete(key) {
    return this.#op(() => {
      this.#data.delete(key);
    });
  }
}

// Shared virtual time. Each pod gets a clock view with its own skew.
function virtualTime(store) {
  let now = 0;
  let sleepers = [];
  const quiesce = async () => {
    do {
      for (let i = 0; i < 6; i++) await tick();
    } while (store.pending > 0);
  };
  return {
    now: () => now,
    set(t) {
      now = t;
    },
    clock(offset = 0) {
      return {
        now: () => now + offset,
        sleep: (ms) => new Promise((resolve) => sleepers.push({ at: now + Math.max(0, ms), resolve })),
      };
    },
    quiesce,
    async runUntil(isDone, limitMs) {
      for (let guard = 0; guard < 200_000; guard++) {
        await quiesce();
        if (isDone()) return;
        if (sleepers.length === 0) throw new Error('nothing left to wake but callers are still waiting');
        const at = Math.min(...sleepers.map((s) => s.at));
        if (at > limitMs) throw new Error(`still waiting at ${at}ms (limit ${limitMs}ms)`);
        now = Math.max(now, at);
        const due = sleepers.filter((s) => s.at <= now);
        sleepers = sleepers.filter((s) => s.at > now);
        for (const s of due) s.resolve();
      }
      throw new Error('too many wake-ups at the same instant (retryAfterMs 0 for a denial?)');
    },
  };
}

function pods(count, { store, vt, capacity, ratePerSec, offsets = [] }) {
  return Array.from({ length: count }, (_, i) =>
    createRateLimiter({ store, clock: vt.clock(offsets[i] ?? 0), capacity, ratePerSec }),
  );
}

// Over any interval [t_i, t_j], admissions must not exceed capacity + rate * (t_j - t_i).
function assertWithinBucket(times, { capacity, ratePerSec }) {
  const sorted = [...times].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i; j < sorted.length; j++) {
      const allowed = capacity + (ratePerSec * (sorted[j] - sorted[i])) / 1000 + 1e-6;
      if (j - i + 1 > allowed) {
        assert.fail(`${j - i + 1} admissions between ${sorted[i]}ms and ${sorted[j]}ms, the bucket allows ${Math.floor(allowed)}`);
      }
    }
  }
}

// ---------------------------------------------------------------- burst races

test('one pod, 40 concurrent callers on a new key: exactly capacity admitted', async () => {
  const store = new NetworkStore(1);
  const vt = virtualTime(store);
  vt.set(1000);
  const [pod] = pods(1, { store, vt, capacity: 10, ratePerSec: 1 });
  const results = await Promise.all(Array.from({ length: 40 }, () => pod.tryTake('acme')));
  assert.equal(results.filter((r) => r.allowed).length, 10);
});

test('six pods, 120 concurrent callers on a new key: exactly capacity admitted', async () => {
  for (const seed of [2, 3, 4, 5]) {
    const store = new NetworkStore(seed);
    const vt = virtualTime(store);
    vt.set(1000);
    const all = pods(6, { store, vt, capacity: 10, ratePerSec: 1 });
    const calls = [];
    for (let i = 0; i < 120; i++) calls.push(all[i % 6].tryTake('acme'));
    const results = await Promise.all(calls);
    assert.equal(results.filter((r) => r.allowed).length, 10, `seed ${seed}`);
  }
});

test('six pods racing on an existing bucket never spend the same token twice', async () => {
  for (const seed of [6, 7, 8]) {
    const store = new NetworkStore(seed);
    const vt = virtualTime(store);
    vt.set(0);
    const all = pods(6, { store, vt, capacity: 10, ratePerSec: 5 });
    assert.equal((await all[0].tryTake('acme')).allowed, true);
    vt.set(100); // +0.5 token, bucket already full: still 9 left
    const calls = [];
    for (let i = 0; i < 60; i++) calls.push(all[i % 6].tryTake('acme'));
    const results = await Promise.all(calls);
    assert.equal(results.filter((r) => r.allowed).length, 9, `seed ${seed}`);
  }
});

test('multi-token requests across pods stay within the bucket', async () => {
  const store = new NetworkStore(9);
  const vt = virtualTime(store);
  vt.set(0);
  const all = pods(4, { store, vt, capacity: 10, ratePerSec: 1 });
  const calls = [];
  for (let i = 0; i < 24; i++) calls.push(all[i % 4].tryTake('acme', 3));
  const results = await Promise.all(calls);
  assert.equal(results.filter((r) => r.allowed).length, 3);
});

// ---------------------------------------------------------------- sustained overload

test('sustained overload from several pods while time moves: never over budget', async () => {
  for (const seed of [10, 11, 12]) {
    const store = new NetworkStore(seed);
    const vt = virtualTime(store);
    const capacity = 5;
    const ratePerSec = 10;
    const all = pods(4, { store, vt, capacity, ratePerSec });
    const random = rng(seed * 31);
    const calls = [];
    for (let step = 0; step < 400; step++) {
      vt.set(step * 10);
      for (let k = 0; k < 2; k++) calls.push(all[Math.floor(random() * 4)].tryTake('acme'));
      await tick(); // let time move on while earlier calls are still in flight
    }
    const results = await Promise.all(calls);
    const admitted = results.filter((r) => r.allowed).length;
    const budget = capacity + (ratePerSec * vt.now()) / 1000;
    assert.ok(admitted <= budget + 1e-6, `seed ${seed}: admitted ${admitted}, budget ${budget}`);
    assert.ok(admitted >= budget - 3, `seed ${seed}: admitted only ${admitted} of ${budget}`);
  }
});

// ---------------------------------------------------------------- steady traffic

test('steady traffic faster than the refill granularity still gets the full rate', async () => {
  const store = new NetworkStore(13);
  const vt = virtualTime(store);
  const [pod] = pods(1, { store, vt, capacity: 4, ratePerSec: 8 });
  let admitted = 0;
  for (let i = 0; i < 128; i++) {
    vt.set(i * 62.5); // 16 req/s against 8 tokens/s
    if ((await pod.tryTake('acme')).allowed) admitted++;
  }
  // 4 initial tokens + 8/s * 7.9375 s = 67.5
  assert.equal(admitted, 67);
});

// ---------------------------------------------------------------- clock drift

test('pods with drifting clocks cannot push the total over budget', async () => {
  const store = new NetworkStore(15);
  const vt = virtualTime(store);
  const capacity = 5;
  const ratePerSec = 10;
  const offsets = [0, -400, 300];
  const all = pods(3, { store, vt, capacity, ratePerSec, offsets });
  let admitted = 0;
  const end = 20_000;
  for (let t = 0, i = 0; t < end; t += 10, i++) {
    vt.set(t);
    if ((await all[i % 3].tryTake('acme')).allowed) admitted++;
  }
  // A clock that runs ahead can pull at most its lead's worth of tokens forward.
  const budget = capacity + (ratePerSec * (end + Math.max(...offsets))) / 1000;
  assert.ok(admitted <= budget + 1e-6, `admitted ${admitted}, budget ${budget}`);
  assert.ok(admitted >= 0.75 * (capacity + (ratePerSec * end) / 1000), `admitted only ${admitted}`);
});

// ---------------------------------------------------------------- acquire

test('acquire() from three pods: everyone gets through, and never faster than the bucket', async () => {
  const store = new NetworkStore(16);
  const vt = virtualTime(store);
  const capacity = 2;
  const ratePerSec = 5;
  const all = pods(3, { store, vt, capacity, ratePerSec });
  const times = [];
  let settled = 0;
  for (let i = 0; i < 40; i++) {
    all[i % 3].acquire('acme').then(
      () => { times.push(vt.now()); settled++; },
      (err) => { settled++; times.push(err); },
    );
  }
  await vt.runUntil(() => settled === 40, 60_000);
  assert.ok(times.every((t) => typeof t === 'number'), 'every acquire() resolves');
  assertWithinBucket(times, { capacity, ratePerSec });
  // 2 immediately, then 38 at 5/s: done by 7.6 s; allow 1 s of slack for polling.
  assert.ok(Math.max(...times) <= 8600, `last admission at ${Math.max(...times)}ms`);
});
