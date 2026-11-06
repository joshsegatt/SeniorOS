import rowlark from '../../vendor/rowlark/index.js';

/**
 * Customer list uploaded from the back office (comma-separated, header `email,name,newsletter`).
 * @param {string} text
 * @returns {{ customers: { email: string, name: string, newsletter: boolean }[], skipped: number }}
 */
export function importCustomers(text) {
  const customers = [];
  let skipped = 0;
  for (const row of rowlark.parse(text)) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      skipped += 1;
      continue;
    }
    customers.push({ email, name: String(row.name ?? '').trim(), newsletter: String(row.newsletter).trim().toLowerCase() === 'yes' });
  }
  return { customers, skipped };
}
