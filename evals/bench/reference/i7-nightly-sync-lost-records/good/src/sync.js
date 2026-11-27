import { normalizeContact, mergeContact } from './contacts.js';

export const CONTACTS_KEY = 'contacts';

// Pages are fetched in parallel, but the contacts document is read, merged and
// written once, after every page arrived. The old version did a load/merge/save
// per page without awaiting it: concurrent pages overwrote each other's saves
// (lost records) and the promise resolved before anything was persisted.
export async function syncContacts({ remote, store, log = () => {} }) {
  const pages = await remote.listPages();

  const batches = await Promise.all(
    pages.map(async (page) => {
      const records = (await remote.fetchPage(page)).map(normalizeContact);
      log(`page ${page}: ${records.length} contacts`);
      return records;
    }),
  );

  const doc = (await store.load(CONTACTS_KEY)) ?? {};
  let fetched = 0;
  for (const records of batches) {
    for (const contact of records) {
      doc[contact.id] = mergeContact(doc[contact.id], contact);
      fetched++;
    }
  }
  await store.save(CONTACTS_KEY, doc);

  return { pages: pages.length, fetched };
}
