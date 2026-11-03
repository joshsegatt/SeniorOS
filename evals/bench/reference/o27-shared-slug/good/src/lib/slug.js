const trimDashes = (s) => s.replace(/^-+|-+$/g, '');

/**
 * URL slug: accents stripped, lower case, runs of other characters become one dash.
 * The two existing users differ, and their URLs must not change:
 * - posts: only a-z0-9 survive, cut at 80 and then trimmed;
 * - product handles: word characters (so `_`) survive, trimmed and then cut at 60 (a trailing dash can remain).
 */
export function slugify(text, { maxLength = 80, keepUnderscore = false, cutThenTrim = true } = {}) {
  const ascii = text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dashed = ascii.replace(keepUnderscore ? /\W+/g : /[^a-z0-9]+/g, '-');
  return cutThenTrim ? trimDashes(dashed.slice(0, maxLength)) : trimDashes(dashed).slice(0, maxLength);
}
