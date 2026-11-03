/** @param {unknown} value */
function cell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Customer list for the sales team (opened in a spreadsheet).
 * @param {ReturnType<import('../customers/repo.js').createCustomerRepo>} repo
 */
export function customersCsv(repo) {
  const header = ['id', 'name', 'email', 'phone', 'vat_id', 'created_at'];
  const rows = repo.list().map((c) => [c.id, c.name, c.email, c.phone, c.vatId, c.createdAt.slice(0, 10)]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
