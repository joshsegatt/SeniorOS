/** First rule that matches the description wins. */
const RULES = [
  { match: /\b(lohn|salary|gehalt)\b/i, category: 'income' },
  { match: /\b(miete|rent)\b/i, category: 'rent' },
  { match: /\b(coop|migros|denner|aldi|lidl)\b/i, category: 'groceries' },
  { match: /\b(sbb|zvv|bls|postauto)\b/i, category: 'transport' },
  { match: /\b(restaurant|cafe|bar)\b/i, category: 'eating out' },
  { match: /\b(kontoführung|bank fee|gebühr)\b/i, category: 'bank fees' },
];

/** @param {string} description */
export function categorize(description) {
  return RULES.find((r) => r.match.test(description))?.category ?? 'other';
}
