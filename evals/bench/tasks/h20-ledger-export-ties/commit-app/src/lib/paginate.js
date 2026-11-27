import { decodeCursor, encodeCursor } from './cursor.js';

export const MAX_PAGE = 500;

/** One page of rows plus the token for the next page (null on the last page). */
export function fetchPage(store, { cursor = null, limit = 50, order = 'asc', accountId = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_PAGE}`);
  }
  const after = decodeCursor(cursor);
  // Ask for one extra row so we know whether another page exists.
  const rows = store.scan({ order, after, limit: limit + 1, accountId });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null };
}

/** Walks every page and yields rows one by one. Used by exports and batch jobs. */
export function* eachRow(store, { pageSize = 100, order = 'asc', accountId = null } = {}) {
  let cursor = null;
  do {
    const { items, nextCursor } = fetchPage(store, { cursor, limit: pageSize, order, accountId });
    yield* items;
    cursor = nextCursor;
  } while (cursor);
}
