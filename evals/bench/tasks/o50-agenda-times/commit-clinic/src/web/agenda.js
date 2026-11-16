/** @typedef {ReturnType<import('../appointments/store.js').openStore>} Store */

/** The day agenda of one practitioner: booked appointments of a local day, in order. @param {Store} store @param {string} practitionerId @param {string} date "2026-11-19" */
export function dayAgenda(store, practitionerId, date) {
  const doctor = store.practitioner(practitionerId);
  const appointments = store
    .appointments()
    .filter((a) => a.practitionerId === practitionerId && a.status === 'booked' && a.date === date)
    .sort((x, y) => x.time.localeCompare(y.time))
    .map((a) => ({ id: a.id, time: a.time, patient: store.patient(a.patientId).name, durationMin: a.durationMin, channel: a.channel }));
  return { heading: `${doctor.name}, ${date}`, appointments };
}
