import { migrations } from '../db/migrations.js';

/**
 * The clinic database. Development opens a copy (data/clinic.json); production uses the same interface over Postgres.
 * Opening runs the pending migrations from src/db/migrations.js.
 * @typedef {{ id: string, name: string }} Practitioner
 * @typedef {{ id: string, name: string, phone: string }} Patient
 * @typedef {{ id: string, practitionerId: string, patientId: string, date: string, time: string, durationMin: number, channel: 'phone' | 'online' | 'desk', status: 'booked' | 'cancelled', remindedAt: string | null }} Appointment
 * @param {Record<string, any>} [data]
 */
export function openStore(data = {}) {
  const db = structuredClone({ migrations: [], practitioners: [], patients: [], appointments: [], ...data });
  for (const m of migrations) {
    if (db.migrations.includes(m.id)) continue;
    m.up(db);
    db.migrations.push(m.id);
  }
  let seq = Math.max(500, ...db.appointments.map((a) => Number(String(a.id).slice(2)) || 0));
  /** @param {string} id */
  const find = (id) => db.appointments.find((a) => a.id === id);
  return {
    nextId() {
      seq += 1;
      return `a-${seq}`;
    },
    /** @param {string} id @returns {Practitioner} */
    practitioner(id) {
      const found = db.practitioners.find((p) => p.id === id);
      if (!found) throw new Error(`unknown practitioner ${id}`);
      return { ...found };
    },
    /** @param {string} id @returns {Patient} */
    patient(id) {
      const found = db.patients.find((p) => p.id === id);
      if (!found) throw new Error(`unknown patient ${id}`);
      return { ...found };
    },
    /** @param {Appointment} appointment */
    insertAppointment(appointment) {
      db.appointments.push({ ...appointment });
      return { ...appointment };
    },
    /** @param {string} id @param {Partial<Appointment>} patch */
    updateAppointment(id, patch) {
      const found = find(id);
      if (!found) throw new Error(`unknown appointment ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    /** @param {string} id @returns {Appointment | null} */
    appointment(id) {
      const found = find(id);
      return found ? { ...found } : null;
    },
    /** @returns {Appointment[]} */
    appointments() {
      return db.appointments.map((a) => ({ ...a }));
    },
    /** The rows as stored (what a backup or a copy like data/clinic.json holds). */
    dump() {
      return structuredClone(db);
    },
  };
}
