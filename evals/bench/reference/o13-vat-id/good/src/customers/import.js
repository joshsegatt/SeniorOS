import { validateCustomer } from './model.js';

/**
 * Imports the customer export of our accounting tool (semicolon-separated, first line is the header).
 * Rows that fail validation or whose email we already have are skipped.
 * @param {string} csvText
 * @param {ReturnType<import('./repo.js').createCustomerRepo>} repo
 * @param {() => Date} [now]
 */
export function importFromAccounting(csvText, repo, now = () => new Date()) {
  const [headerLine, ...lines] = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = headerLine.split(';').map((h) => h.trim());
  const col = (/** @type {string[]} */ cells, /** @type {string} */ name) => {
    const i = header.indexOf(name);
    return i < 0 ? undefined : (cells[i] ?? '').trim();
  };
  const result = { imported: 0, skipped: 0 };
  for (const line of lines) {
    const cells = line.split(';');
    const input = { name: col(cells, 'Customer'), email: col(cells, 'E-mail'), phone: col(cells, 'Telephone'), vatId: col(cells, 'VAT number') };
    const checked = validateCustomer(input);
    if (!checked.ok || repo.findByEmail(/** @type {string} */ (checked.value.email))) {
      result.skipped += 1;
      continue;
    }
    const { name, email, phone, vatId } = /** @type {any} */ (checked.value);
    repo.insert({ name, email, phone, vatId, createdAt: now().toISOString() });
    result.imported += 1;
  }
  return result;
}
