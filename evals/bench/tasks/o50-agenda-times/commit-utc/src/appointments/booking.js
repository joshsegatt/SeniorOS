import { zonedToUtc } from './time.js';

/** @typedef {ReturnType<import('./store.js').openStore>} Store */

const MIN = 60_000;

/** Does a booked appointment of the practitioner overlap the slot? @param {Store} store @param {string} practitionerId @param {Date} start @param {number} durationMin @param {string} [exceptId] */
export function slotTaken(store, practitionerId, start, durationMin, exceptId) {
  const from = start.getTime();
  const to = from + durationMin * MIN;
  return store
    .appointments()
    .filter((a) => a.practitionerId === practitionerId && a.status === 'booked' && a.id !== exceptId)
    .some((a) => {
      const s = new Date(a.startsAt).getTime();
      return s < to && from < s + a.durationMin * MIN;
    });
}

/**
 * Books an appointment from the desk form or the online booking page. Staff and patients pick a local date and time;
 * the appointment stores the UTC instant.
 * @param {Store} store
 * @param {{ practitionerId: string, patientId: string, date: string, time: string, durationMin?: number, channel?: 'phone' | 'online' | 'desk' }} input
 */
export function bookAppointment(store, { practitionerId, patientId, date, time, durationMin = 30, channel = 'desk' }) {
  store.practitioner(practitionerId);
  store.patient(patientId);
  const start = zonedToUtc(date, time);
  if (slotTaken(store, practitionerId, start, durationMin)) throw new Error('slot taken');
  return store.insertAppointment({ id: store.nextId(), practitionerId, patientId, startsAt: start.toISOString(), durationMin, channel, status: 'booked', remindedAt: null });
}

/** @param {Store} store @param {string} id @param {{ date: string, time: string }} to local date and time */
export function rescheduleAppointment(store, id, { date, time }) {
  const a = store.appointment(id);
  if (!a || a.status !== 'booked') throw new Error(`no booked appointment ${id}`);
  const start = zonedToUtc(date, time);
  if (slotTaken(store, a.practitionerId, start, a.durationMin, id)) throw new Error('slot taken');
  return store.updateAppointment(id, { startsAt: start.toISOString(), remindedAt: null });
}

/** @param {Store} store @param {string} id */
export function cancelAppointment(store, id) {
  const a = store.appointment(id);
  if (!a) throw new Error(`no appointment ${id}`);
  return store.updateAppointment(id, { status: 'cancelled' });
}
