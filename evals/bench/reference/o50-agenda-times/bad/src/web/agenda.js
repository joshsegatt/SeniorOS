import { localParts, zonedToUtc } from '../appointments/time.js';

/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

/** Appointments booked before the release still have the local date and time instead of startsAt. @param {Record<string, any>} a */
const startOf = (a) => (a.startsAt ? new Date(a.startsAt) : zonedToUtc(a.date, a.time));

/** The day agenda of one practitioner: booked appointments of a local day, in order. @param {Store} store @param {string} practitionerId @param {string} date "2026-11-19" */
export function dayAgenda(store, practitionerId, date) {
  const doctor = store.practitioner(practitionerId);
  const appointments = store
    .appointments()
    .filter((a) => a.practitionerId === practitionerId && a.status === 'booked')
    .map((a) => ({ a, start: startOf(a) }))
    .filter(({ start }) => localParts(start).date === date)
    .sort((x, y) => x.start.getTime() - y.start.getTime())
    .map(({ a, start }) => ({ id: a.id, time: localParts(start).time, patient: store.patient(a.patientId).name, durationMin: a.durationMin, channel: a.channel }));
  return { heading: `${doctor.name}, ${date}`, appointments };
}
