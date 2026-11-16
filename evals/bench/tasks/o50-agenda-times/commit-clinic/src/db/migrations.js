/**
 * Schema migrations for the clinic database, applied in order by openStore. Each one runs once per database:
 * its id is recorded in `db.migrations` when it has run.
 * @typedef {{ migrations: string[], practitioners: object[], patients: object[], appointments: Record<string, any>[] }} Db
 * @type {{ id: string, up: (db: Db) => void }[]}
 */
export const migrations = [
  {
    id: '001-appointment-channel',
    // Appointments booked before online booking have no channel: they were all booked by phone.
    up(db) {
      for (const a of db.appointments) a.channel ??= 'phone';
    },
  },
];
