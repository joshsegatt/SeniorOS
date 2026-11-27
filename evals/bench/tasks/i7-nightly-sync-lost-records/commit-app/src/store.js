// In-memory document store with the same contract as the production store.
// Values are copied on the way in and out, like a real serialised store.

const noLatency = () => Promise.resolve();

export class MemoryStore {
  #data = new Map();
  #latency;

  constructor({ latency = noLatency } = {}) {
    this.#latency = latency;
  }

  async load(key) {
    await this.#latency('load', key);
    const value = this.#data.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async save(key, value) {
    const copy = structuredClone(value);
    await this.#latency('save', key);
    this.#data.set(key, copy);
  }
}
