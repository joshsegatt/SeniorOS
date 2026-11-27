// In-memory job store. Production uses the Postgres-backed store with the same
// interface (insert/get/update/list); every read returns a copy, like a DB row.
//
// Job shape:
//   { id, type, payload, status, attempts, runAt, lastError, finishedAt }
// status: 'queued' | 'running' | 'retrying' | 'done' | 'failed'

export class JobStore {
  #jobs = new Map();

  insert(job) {
    if (this.#jobs.has(job.id)) throw new Error(`job ${job.id} already exists`);
    this.#jobs.set(job.id, structuredClone(job));
    return structuredClone(job);
  }

  get(id) {
    const job = this.#jobs.get(id);
    return job ? structuredClone(job) : undefined;
  }

  update(id, patch) {
    const job = this.#jobs.get(id);
    if (!job) throw new Error(`job ${id} not found`);
    Object.assign(job, structuredClone(patch));
    return structuredClone(job);
  }

  list({ status } = {}) {
    const statuses = status === undefined ? null : [].concat(status);
    const out = [];
    for (const job of this.#jobs.values()) {
      if (!statuses || statuses.includes(job.status)) out.push(structuredClone(job));
    }
    return out;
  }
}
