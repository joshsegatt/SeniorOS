// Registry of the accounts we export transactions from.
// Formats per source: docs/sources.md.
export const SOURCES = Object.freeze({
  ubs: { name: 'UBS business account', currency: 'CHF', dateFormat: 'DD.MM.YYYY' },
  sparkasse: { name: 'Sparkasse Lörrach', currency: 'EUR', dateFormat: 'DD.MM.YYYY' },
  amex: { name: 'Amex corporate card', currency: 'USD', dateFormat: 'MM/DD/YYYY' },
  qonto: { name: 'Qonto (FR entity)', currency: 'EUR', dateFormat: 'YYYY-MM-DD' },
});

export function getSource(id) {
  const source = SOURCES[id];
  if (!source) throw new Error(`unknown source "${id}"`);
  return { id, ...source };
}
