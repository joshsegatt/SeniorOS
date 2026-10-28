/**
 * In-memory tables. Production swaps this for the Postgres adapter, which exposes the same Map-like API.
 * @returns {{ customers: Map<string, any>, orders: Map<string, any>, sessions: Map<string, any> }}
 */
export function createDb() {
  return { customers: new Map(), orders: new Map(), sessions: new Map() };
}
