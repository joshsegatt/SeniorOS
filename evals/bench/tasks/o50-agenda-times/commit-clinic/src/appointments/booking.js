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
      const s = zonedToUtc(a.date, a.time).getTime();
      return s < to && from < s + a.durationMin * MIN;
    });
}

/**
 * Books an appointment from the desk form or the online booking page (local date and time).
 * @param {Store} store
 * @param {{ practitionerId: string, patientId: string, date: string, time: string, durationMin?: number, channel?: 'phone' | 'online' | 'desk' }} input
 */
export function bookAppointment(store, { practitionerId, patientId, date, time, durationMin = 30, channel = 'desk' }) {
  store.practitioner(practitionerId);
  store.patient(patientId);
  if (slotTaken(store, practitionerId, zonedToUtc(date, time), durationMin)) throw new Error('slot taken');
  return store.insertAppointment({ id: store.nextId(), practitionerId, patientId, date, time, durationMin, channel, status: 'booked', remindedAt: null });
}

/** @param {Store} store @param {string} id @param {{ date: string, time: string }} to */
export function rescheduleAppointment(store, id, { date, time }) {
  const a = store.appointment(id);
  if (!a || a.status !== 'booked') throw new Error(`no booked appointment ${id}`);
  if (slotTaken(store, a.practitionerId, zonedToUtc(date, time), a.durationMin, id)) throw new Error('slot taken');
  return store.updateAppointment(id, { date, time, remindedAt: null });
}

/** @param {Store} store @param {string} id */
export function cancelAppointment(store, id) {
  const a = store.appointment(id);
  if (!a) throw new Error(`no appointment ${id}`);
  return store.updateAppointment(id, { status: 'cancelled' });
}
