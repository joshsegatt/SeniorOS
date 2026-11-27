// Stand-in for the CRM API client. Same interface as the real one:
// listPages() and fetchPage(page).

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class InMemoryRemote {
  #contacts;
  #pageSize;
  #delay;

  constructor(contacts, { pageSize = 50, delay = () => 0 } = {}) {
    this.#contacts = contacts;
    this.#pageSize = pageSize;
    this.#delay = delay;
  }

  async listPages() {
    const count = Math.ceil(this.#contacts.length / this.#pageSize);
    return Array.from({ length: count }, (_, i) => i);
  }

  async fetchPage(page) {
    await sleep(this.#delay(page));
    const start = page * this.#pageSize;
    return structuredClone(this.#contacts.slice(start, start + this.#pageSize));
  }
}
