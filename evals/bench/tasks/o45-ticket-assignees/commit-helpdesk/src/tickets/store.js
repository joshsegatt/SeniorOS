import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { migrations } from '../../scripts/migrations/index.js';

const DATA_FILE = new URL('../../data/tickets.json', import.meta.url);

/** The shape the code reads and writes: the version of the newest migration. */
export const SCHEMA_VERSION = Math.max(0, ...migrations.map((m) => m.version));

/**
 * @typedef {{ id: string, subject: string, requester: string, status: 'open' | 'pending' | 'solved' | 'closed',
 *   priority: 'high' | 'normal' | 'low', assignee: string | null, createdAt: string, updatedAt: string,
 *   firstResponseAt: string | null, escalatedAt: string | null, tags: string[] }} Ticket
 */

/** Runs the migrations newer than the document's version on its tickets. @param {{ schemaVersion?: number, tickets?: any[] }} doc */
function migrate(doc) {
  const from = doc.schemaVersion ?? 0;
  let tickets = doc.tickets ?? [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version > from) tickets = tickets.map((t) => m.up(t));
  }
  return tickets;
}

/**
 * In-memory ticket store over a saved document `{ schemaVersion, tickets }`.
 * @param {{ schemaVersion?: number, tickets?: any[] }} [doc]
 * @param {string | URL | null} [file] where save() writes
 */
export function createTicketStore(doc = { schemaVersion: SCHEMA_VERSION, tickets: [] }, file = null) {
  /** @type {Map<string, Ticket>} */
  const rows = new Map(migrate(doc).map((t) => [t.id, { ...t }]));
  let seq = Math.max(1000, ...[...rows.keys()].map((id) => Number(id.replace(/^T-/, '')) || 0));
  return {
    nextId() {
      seq += 1;
      return `T-${seq}`;
    },
    /** @param {string} id */
    get(id) {
      const t = rows.get(id);
      return t ? structuredClone(t) : null;
    },
    all() {
      return [...rows.values()].map((t) => structuredClone(t));
    },
    /** @param {Ticket} ticket */
    insert(ticket) {
      if (rows.has(ticket.id)) throw new Error(`duplicate ticket id: ${ticket.id}`);
      rows.set(ticket.id, structuredClone(ticket));
      return structuredClone(ticket);
    },
    /** Merges `changes` into a saved ticket. @param {string} id @param {Partial<Ticket>} changes */
    update(id, changes) {
      const t = rows.get(id);
      if (!t) throw new Error(`unknown ticket: ${id}`);
      const next = { ...t, ...structuredClone(changes) };
      rows.set(id, next);
      return structuredClone(next);
    },
    save() {
      if (!file) throw new Error('this store has no file');
      writeFileSync(file, `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, tickets: [...rows.values()] }, null, 2)}\n`);
    },
  };
}

/** The store over data/tickets.json (or another file in the same format). @param {string | URL} [file] */
export function openTicketStore(file = DATA_FILE) {
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { schemaVersion: SCHEMA_VERSION, tickets: [] };
  return createTicketStore(doc, file);
}
