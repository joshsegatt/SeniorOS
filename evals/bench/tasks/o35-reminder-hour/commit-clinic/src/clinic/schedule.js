import { clinicClock } from './time.js';

/**
 * The reception screen: the day's appointments in order, optionally for one doctor.
 * @param {ReturnType<import('./store.js').createClinicStore>} store
 * @param {string} date YYYY-MM-DD, a clinic day
 * @param {string} [doctor]
 */
export function daySchedule(store, date, doctor) {
  return store
    .appointments()
    .filter((a) => a.status !== 'cancelled' && (!doctor || a.doctor === doctor))
    .map((a) => ({ a, at: Date.parse(a.startsAt), clock: clinicClock(new Date(a.startsAt)) }))
    .filter((x) => x.clock.date === date)
    .sort((x, y) => x.at - y.at)
    .map(({ a, clock }) => ({ id: a.id, time: clock.time, doctor: a.doctor, patient: store.patient(a.patientId)?.name ?? '?', status: a.status }));
}
