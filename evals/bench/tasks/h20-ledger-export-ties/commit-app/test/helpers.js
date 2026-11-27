import { createLedgerApp } from '../src/app.js';

export const T0 = Date.parse('2026-10-01T06:00:00Z') / 1000;

/** Builds an app from [bookedAtOffsetSeconds, account, amount, memo] tuples. */
export function appWith(rows) {
  const app = createLedgerApp();
  const text = rows
    .map(([offset, account, amount, memo]) =>
      JSON.stringify({ booked: new Date((T0 + offset) * 1000).toISOString(), account, amount, memo }),
    )
    .join('\n');
  app.importStatement(text);
  return app;
}

export function csvIds(csv) {
  return csv.split('\r\n').slice(1).filter(Boolean).map((line) => line.split(',')[0]);
}
