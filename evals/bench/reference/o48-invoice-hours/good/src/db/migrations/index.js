import entryBillable from './001-entry-billable.js';
import entryMinutes from './002-entry-minutes.js';

/** Every migration, oldest first. Add new ones at the end. */
export const migrations = [entryBillable, entryMinutes];
