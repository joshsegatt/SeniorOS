import { assertSlot, fromClinicTime } from './time.js';

/** @typedef {ReturnType<import('./store.js').createClinicStore>} ClinicStore */

/** Whether the doctor already has an appointment starting at that instant. @param {ClinicStore} store @param {string} doctor @param {string} startsAt */
export function isSlotTaken(store, doctor, startsAt) {
  const at = Date.parse(startsAt);
  return store.appointments().some((a) => a.doctor === doctor && a.status !== 'cancelled' && Date.parse(a.startsAt) === at);
}

/**
 * Reception desk: books a registered patient into a slot (date and time as on the clinic clock).
 * @param {ClinicStore} store
 * @param {{ patientId: string, doctor: string, date: string, time: string }} input
 */
export function bookAtReception(store, input) {
  if (!store.patient(input.patientId)) throw new Error(`unknown patient ${input.patientId}`);
  if (!input.doctor) throw new Error('doctor is required');
  assertSlot(input.time);
  const startsAt = fromClinicTime(input.date, input.time);
  if (isSlotTaken(store, input.doctor, startsAt)) throw new Error('slot already taken');
  return store.insertAppointment({ id: store.nextId('ap'), patientId: input.patientId, doctor: input.doctor, startsAt, status: 'booked', source: 'reception' });
}

/** Registers a patient at the reception desk. @param {ClinicStore} store @param {{ name: string, phone: string }} input */
export function registerPatient(store, input) {
  const name = String(input.name ?? '').trim();
  const phone = String(input.phone ?? '').replace(/[\s-]/g, '');
  if (!name) throw new Error('name is required');
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error('invalid phone');
  return store.patientByPhone(phone) ?? store.insertPatient({ id: store.nextId('p'), name, phone });
}

/** The patient arrived. @param {ClinicStore} store @param {string} id */
export function checkIn(store, id) {
  return store.updateAppointment(id, { status: 'checked-in' });
}

/** @param {ClinicStore} store @param {string} id */
export function cancel(store, id) {
  return store.updateAppointment(id, { status: 'cancelled' });
}
