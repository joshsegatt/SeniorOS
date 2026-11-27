// Parses an exported amount string into integer minor units (cents / Rappen),
// strictly in the source's format (docs/sources.md). Throws when the string
// does not match: a guessed amount is worse than a stopped month close.

const FORMATS = {
  ubs: { groups: ["'", '’'], decimal: '.', minus: ['-'], trailingMinus: false, parens: false },
  sparkasse: { groups: ['.'], decimal: ',', minus: ['-'], trailingMinus: true, parens: false },
  amex: { groups: [','], decimal: '.', minus: ['-'], trailingMinus: false, parens: true },
  qonto: { groups: [' ', ' ', ' '], decimal: ',', minus: ['-', '−'], trailingMinus: false, parens: false },
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS = Object.fromEntries(
  Object.entries(FORMATS).map(([id, f]) => {
    const group = `[${f.groups.map(escapeRe).join('')}]`;
    const pattern = new RegExp(`^(\\d{1,3}(?:${group}\\d{3})+|\\d+)(?:${escapeRe(f.decimal)}(\\d{1,2}))?$`);
    return [id, { ...f, group: new RegExp(group, 'g'), pattern }];
  }),
);

export function parseAmount(raw, source) {
  const format = PATTERNS[source.id];
  if (!format) throw new Error(`no amount format for source "${source.id}"`);

  let text = String(raw ?? '').trim();
  let negative = false;
  if (format.parens && text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1).trim();
  } else if (format.trailingMinus && text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1).trimEnd();
  } else if (format.minus.includes(text[0])) {
    negative = true;
    text = text.slice(1);
  } else if (text[0] === '+') {
    text = text.slice(1);
  }

  const match = format.pattern.exec(text);
  if (!match) throw new Error(`amount "${raw}" does not match the ${source.id} format`);

  const units = match[1].replace(format.group, '');
  const minor = Number(units) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error(`amount "${raw}" is too large`);
  return negative && minor !== 0 ? -minor : minor;
}
