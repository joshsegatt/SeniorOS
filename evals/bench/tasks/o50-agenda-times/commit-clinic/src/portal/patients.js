import { zonedToUtc } from '../appointments/time.js';

/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

/** "My appointments" in the patient portal: the patient's upcoming booked appointments, soonest first. @param {Store} store @param {string} patientId @param {Date} now */
export function upcomingFor(store, patientId, now) {
  return store
    .appointments()
    .filter((a) => a.patientId === patientId && a.status === 'booked')
    .map((a) => ({ a, start: zonedToUtc(a.date, a.time) }))
    .filter(({ start }) => start > now)
    .sort((x, y) => x.start.getTime() - y.start.getTime())
    .map(({ a }) => ({ id: a.id, practitioner: store.practitioner(a.practitionerId).name, date: a.date, time: a.time, durationMin: a.durationMin }));
}
