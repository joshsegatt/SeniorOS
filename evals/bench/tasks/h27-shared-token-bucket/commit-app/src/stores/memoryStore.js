// In-process store with the same async interface as the Redis store.
// Used in tests and for local development (`ACME_STORE=memory`).
//
//   get(key)                          -> Promise<string | null>
//   set(key, value)                   -> Promise<void>
//   compareAndSet(key, expected, next) -> Promise<boolean>
//       atomically: if the current value === expected (null = key absent),
//       store `next` and resolve true; otherwise change nothing and resolve false.

export class MemoryStore {
  #data = new Map();

  async get(key) {
    await null;
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  async set(key, value) {
    await null;
    this.#data.set(key, value);
  }

  async compareAndSet(key, expected, next) {
    await null;
    const current = this.#data.has(key) ? this.#data.get(key) : null;
    if (current !== expected) return false;
    this.#data.set(key, next);
    return true;
  }

  async delete(key) {
    await null;
    this.#data.delete(key);
  }
}
