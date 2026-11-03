/**
 * Client for the document database service used in staging and production.
 * @param {{ url: string, token: string, fetch?: typeof fetch }} options
 * @returns {import('./memory.js').Db}
 */
export function createHttpDb({ url, token, fetch: doFetch = fetch }) {
  /** @param {'find' | 'findOne'} op @param {string} collection @param {object} filter */
  async function call(op, collection, filter) {
    const res = await doFetch(`${url}/v1/${collection}/${op}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ filter }),
    });
    if (!res.ok) throw new Error(`db ${op} ${collection} failed: ${res.status}`);
    return (await res.json()).result;
  }
  return {
    find: (collection, filter = {}) => call('find', collection, filter),
    findOne: (collection, filter = {}) => call('findOne', collection, filter),
  };
}
