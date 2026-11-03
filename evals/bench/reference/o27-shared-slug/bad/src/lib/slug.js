/** URL slug: accents stripped, lower case, runs of other characters become one dash, at most maxLength long. */
export function slugify(text, { maxLength = 80 } = {}) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
}
