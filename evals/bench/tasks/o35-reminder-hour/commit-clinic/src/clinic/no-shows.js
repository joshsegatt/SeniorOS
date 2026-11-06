import { CLINIC } from './config.js';

/**
 * Job run every 5 minutes: patients who have not checked in 15 minutes after their start time are marked
 * as no-shows (the slot is offered to walk-ins).
 * @param {ReturnType<import('./store.js').createClinicStore>} store
 * @param {Date} now
 * @returns {string[]} ids of the appointments marked
 */
export function markNoShows(store, now) {
  const cutoff = now.getTime() - CLINIC.noShowAfterMinutes * 60 * 1000;
  const late = store.appointments().filter((a) => a.status === 'booked' && Date.parse(a.startsAt) <= cutoff);
  for (const a of late) store.updateAppointment(a.id, { status: 'no-show' });
  return late.map((a) => a.id);
}
