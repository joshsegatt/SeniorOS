/**
 * Imports the newsletter signups export from marketing (CSV: email,name,signed_up_at).
 * @param {string} csvText
 * @param {ReturnType<typeof import('./customers.js').createCustomerStore>} store
 * @returns {Promise<{ subscribed: number, added: number }>}
 */
export async function importSignups(csvText, store) {
  const [, ...rows] = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  let subscribed = 0;
  let added = 0;
  for (const row of rows) {
    const [email, name = ''] = row.split(',').map((cell) => cell.trim());
    if (!email) continue;
    const existing = store.findByEmail(email);
    if (existing) {
      if (existing.kind === 'customer') subscribed += 1;
      store.update(existing.id, { newsletter: true });
    } else {
      store.add({ email, name, kind: 'lead', newsletter: true });
      added += 1;
    }
  }
  return { subscribed, added };
}
