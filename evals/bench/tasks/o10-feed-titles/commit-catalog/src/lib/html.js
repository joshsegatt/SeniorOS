const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML element content and quoted attributes. @param {string} text */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ENTITIES[/** @type {keyof typeof ENTITIES} */ (ch)]);
}
