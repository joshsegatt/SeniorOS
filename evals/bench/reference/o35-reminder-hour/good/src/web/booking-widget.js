import { isSlotTaken, registerPatient } from '../clinic/appointments.js';
import { assertSlot, fromClinicTime } from '../clinic/time.js';

/**
 * Online booking from the clinic website: the patient picks a doctor, a day and a free slot, and leaves
 * a name and a mobile number (an existing patient is matched by phone).
 * @param {ReturnType<import('../clinic/store.js').createClinicStore>} store
 * @param {{ name: string, phone: string, doctor: string, date: string, time: string }} form
 */
export function bookOnline(store, form) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) throw new Error('pick a day');
  assertSlot(form.time);
  if (!form.doctor) throw new Error('pick a doctor');
  const startsAt = fromClinicTime(form.date, form.time);
  if (isSlotTaken(store, form.doctor, startsAt)) throw new Error('This time was just taken, please pick another one.');
  const patient = registerPatient(store, { name: form.name, phone: form.phone });
  return store.insertAppointment({ id: store.nextId('ap'), patientId: patient.id, doctor: form.doctor, startsAt, status: 'booked', source: 'online' });
}
