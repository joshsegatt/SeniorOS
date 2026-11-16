import { zonedToUtc } from '../appointments/time.js';

/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

/** 2026-11-19T08:00:00.000Z -> 20261119T080000Z @param {Date} d */
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** The calendar feed a practitioner subscribes to from their phone (iCalendar, times in UTC). @param {Store} store @param {string} practitionerId */
export function icsFeed(store, practitionerId) {
  const doctor = store.practitioner(practitionerId);
  const events = store
    .appointments()
    .filter((a) => a.practitionerId === practitionerId && a.status === 'booked')
    .map((a) => {
      const start = zonedToUtc(a.date, a.time);
      const end = new Date(start.getTime() + a.durationMin * 60_000);
      return ['BEGIN:VEVENT', `UID:${a.id}@clinic`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${store.patient(a.patientId).name}`, 'END:VEVENT'];
    });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${doctor.name}`, ...events.flat(), 'END:VCALENDAR'].join('\r\n');
}
