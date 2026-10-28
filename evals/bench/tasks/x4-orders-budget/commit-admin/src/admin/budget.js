// The admin back office reads from a replica in another region (~80 ms per round trip). Every admin request may
// make at most ROUND_TRIP_BUDGET round trips to the database, whatever the number of rows it returns. Requests over
// budget are logged and show up in the weekly performance review.
export const ROUND_TRIP_BUDGET = 3;

/**
 * Wraps a request handler and logs requests that go over the round-trip budget.
 * @param {{ stats: { roundTrips: number } }} db
 * @param {(req: any) => Promise<any>} handler
 * @param {{ warn(message: string): void }} logger
 */
export function withRoundTripBudget(db, handler, logger) {
  return async (req) => {
    const before = db.stats.roundTrips;
    const res = await handler(req);
    const used = db.stats.roundTrips - before;
    if (used > ROUND_TRIP_BUDGET) logger.warn(`${req.method} ${req.path}: ${used} round trips (budget ${ROUND_TRIP_BUDGET})`);
    return res;
  };
}
