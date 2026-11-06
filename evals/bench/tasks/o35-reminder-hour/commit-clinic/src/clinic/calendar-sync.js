import { isSlotTaken } from './appointments.js';

/**
 * Imports the appointments doctors add directly in their own calendars (Google Calendar events tagged
 * with the patient id). Known events and cancelled events are skipped, so the sync can run on the same
 * page of events again.
 * @param {ReturnType<import('./store.js').createClinicStore>} store
 * @param {string} doctor
 * @param {{ items: { id: string, status: string, start: { dateTime: string }, extendedProperties?: { private?: { patientId?: string } } }[] }} page
 */
export function syncDoctorCalendar(store, doctor, page) {
  const result = { added: 0, skipped: 0 };
  const known = new Set(store.appointments().map((a) => a.calendarEventId).filter(Boolean));
  for (const event of page.items) {
    const patientId = event.extendedProperties?.private?.patientId;
    if (event.status === 'cancelled' || known.has(event.id) || !patientId || !store.patient(patientId)) {
      result.skipped += 1;
      continue;
    }
    const startsAt = new Date(event.start.dateTime).toISOString();
    if (isSlotTaken(store, doctor, startsAt)) {
      result.skipped += 1;
      continue;
    }
    store.insertAppointment({ id: store.nextId('ap'), patientId, doctor, startsAt, status: 'booked', source: 'calendar', calendarEventId: event.id });
    result.added += 1;
  }
  return result;
}
