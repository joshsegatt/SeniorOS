// Every change to how tickets are stored is a numbered migration, registered here in order. The ticket store
// (src/tickets/store.js) runs the ones newer than a file's schemaVersion when it opens the file.
import * as priorityNames from './001-priority-names.js';

export const migrations = [priorityNames];
