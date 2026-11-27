import { normalizeContact, mergeContact } from './contacts.js';

export const CONTACTS_KEY = 'contacts';

export async function syncContacts({ remote, store, log = () => {} }) {
  const pages = await remote.listPages();
  let fetched = 0;

  pages.forEach(async (page) => {
    const records = (await remote.fetchPage(page)).map(normalizeContact);
    const doc = (await store.load(CONTACTS_KEY)) ?? {};
    for (const contact of records) {
      doc[contact.id] = mergeContact(doc[contact.id], contact);
    }
    await store.save(CONTACTS_KEY, doc);
    fetched += records.length;
    log(`page ${page}: ${records.length} contacts`);
  });

  return { pages: pages.length, fetched };
}
