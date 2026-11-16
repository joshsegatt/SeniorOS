import { openFileStore } from '../src/db/store.js';
import { migrate } from '../src/db/migrate.js';

// Production points STORE_FILE at the database through the same interface; locally it is a JSON file.
const store = openFileStore(process.env.STORE_FILE ?? 'data/store.json');
const ran = migrate(store);
console.log(ran.length ? `applied ${ran.join(', ')}` : 'nothing to migrate');
