/**
 * In-memory clinic store (production uses the same interface over Postgres).
 * @typedef {{ id: string, name: string, phone: string }} Patient
 * @typedef {{ id: string, patientId: string, doctor: string, startsAt: string, status: 'booked' | 'checked-in' | 'no-show' | 'cancelled', source: 'reception' | 'online' | 'calendar', calendarEventId?: string }} Appointment
 */
export function createClinicStore() {
  /** @type {Patient[]} */
  const patients = [];
  /** @type {Appointment[]} */
  const appointments = [];
  const seq = { p: 1000, ap: 5000 };
  return {
    /** @param {'p' | 'ap'} prefix */
    nextId(prefix) {
      seq[prefix] += 1;
      return `${prefix}-${seq[prefix]}`;
    },
    /** @param {Patient} patient */
    insertPatient(patient) {
      patients.push({ ...patient });
      return { ...patient };
    },
    /** @param {string} id */
    patient(id) {
      const found = patients.find((p) => p.id === id);
      return found ? { ...found } : null;
    },
    /** @param {string} phone */
    patientByPhone(phone) {
      const found = patients.find((p) => p.phone === phone);
      return found ? { ...found } : null;
    },
    /** @param {Appointment} appointment */
    insertAppointment(appointment) {
      appointments.push({ ...appointment });
      return { ...appointment };
    },
    /** @param {string} id @param {Partial<Appointment>} patch */
    updateAppointment(id, patch) {
      const found = appointments.find((a) => a.id === id);
      if (!found) throw new Error(`unknown appointment ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    /** @param {string} id */
    appointment(id) {
      const found = appointments.find((a) => a.id === id);
      return found ? { ...found } : null;
    },
    appointments() {
      return appointments.map((a) => ({ ...a }));
    },
  };
}
