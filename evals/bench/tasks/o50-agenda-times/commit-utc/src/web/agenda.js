import { localParts } from '../appointments/time.js';

/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

/** The day agenda of one practitioner: booked appointments of a local day, in order. @param {Store} store @param {string} practitionerId @param {string} date "2026-11-19" */
export function dayAgenda(store, practitionerId, date) {
  const doctor = store.practitioner(practitionerId);
  const appointments = store
    .appointments()
    .filter((a) => a.practitionerId === practitionerId && a.status === 'booked')
    .map((a) => ({ a, start: new Date(a.startsAt) }))
    .filter(({ start }) => localParts(start).date === date)
    .sort((x, y) => x.start.getTime() - y.start.getTime())
    .map(({ a, start }) => ({ id: a.id, time: localParts(start).time, patient: store.patient(a.patientId).name, durationMin: a.durationMin, channel: a.channel }));
  return { heading: `${doctor.name}, ${date}`, appointments };
}
