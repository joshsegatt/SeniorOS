import { zonedToUtc } from '../appointments/time.js';

/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

const DAY = 86_400_000;

/** Reminder SMS, once per appointment, for booked appointments starting within 24 hours. The job runs every 15 minutes. @param {Store} store @param {Date} now */
export function dueReminders(store, now) {
  return store
    .appointments()
    .filter((a) => a.status === 'booked' && !a.remindedAt)
    .filter((a) => {
      const start = zonedToUtc(a.date, a.time).getTime();
      return start > now.getTime() && start <= now.getTime() + DAY;
    })
    .map((a) => ({
      appointmentId: a.id,
      to: store.patient(a.patientId).phone,
      text: `Reminder: ${store.practitioner(a.practitionerId).name} on ${a.date} at ${a.time}. Reply C to cancel.`,
    }));
}

/** @param {Store} store @param {string[]} ids @param {Date} now */
export function markReminded(store, ids, now) {
  for (const id of ids) store.updateAppointment(id, { remindedAt: now.toISOString() });
}
