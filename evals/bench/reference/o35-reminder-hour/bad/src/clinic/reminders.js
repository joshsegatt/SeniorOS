import { CLINIC } from './config.js';
import { clinicClock, fromClinicTime } from './time.js';

const HOUR_MS = 60 * 60 * 1000;

/** @typedef {import('./store.js').Appointment} Appointment @typedef {import('./store.js').Patient} Patient */

/**
 * The SMS sent the day before an appointment.
 * @param {Appointment} appointment
 * @param {Patient} patient
 */
export function reminderText(appointment, patient) {
  // Online bookings store the clinic's wall-clock time with no offset.
  const raw = appointment.startsAt;
  const startsAt = /(Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : fromClinicTime(raw.slice(0, 10), raw.slice(11, 16));
  const c = clinicClock(new Date(startsAt));
  const first = patient.name.split(' ')[0];
  return `Hi ${first}, a reminder of your appointment with ${appointment.doctor} on ${c.weekday} ${c.day} ${c.month} at ${c.time}. To cancel, call ${CLINIC.phone}.`;
}

/**
 * Hourly job: booked appointments starting 23 to 24 hours from now get their reminder.
 * @param {ReturnType<import('./store.js').createClinicStore>} store
 * @param {Date} now
 * @returns {{ appointmentId: string, to: string, text: string }[]}
 */
export function dueReminders(store, now) {
  const from = now.getTime() + 23 * HOUR_MS;
  const until = now.getTime() + 24 * HOUR_MS;
  return store
    .appointments()
    .filter((a) => a.status === 'booked' && Date.parse(a.startsAt) > from && Date.parse(a.startsAt) <= until)
    .map((a) => {
      const patient = /** @type {Patient} */ (store.patient(a.patientId));
      return { appointmentId: a.id, to: patient.phone, text: reminderText(a, patient) };
    });
}
