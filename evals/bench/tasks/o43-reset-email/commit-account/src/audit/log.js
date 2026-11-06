import { appendFile } from 'node:fs/promises';

/**
 * Append-only audit log, one JSON line per event. The directory must exist. Never put passwords or tokens in
 * `data`.
 * @param {string} file
 * @param {() => number} [now]
 */
export function createAuditLog(file, now = Date.now) {
  return {
    /** @param {string} event @param {Record<string, unknown>} [data] */
    async record(event, data = {}) {
      await appendFile(file, `${JSON.stringify({ at: new Date(now()).toISOString(), event, ...data })}\n`);
    },
  };
}
