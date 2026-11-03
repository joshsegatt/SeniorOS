/** @typedef {ReturnType<import('./db.js').createCatalogDb>} CatalogDb */

export const SEP = ' > ';

/** @param {CatalogDb} db @param {string} id */
function mustGet(db, id) {
  const c = db.categories.get(id);
  if (!c) throw new Error(`unknown category ${id}`);
  return c;
}

/** @param {unknown} name */
function cleanCategoryName(name) {
  const value = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new Error('category name is required');
  if (value.includes('>')) throw new Error('category names cannot contain ">"');
  return value;
}

/** @param {CatalogDb} db @param {{ name: string, parentId?: string | null }} input */
export function createCategory(db, input) {
  const parentId = input.parentId ?? null;
  if (parentId) mustGet(db, parentId);
  const category = { id: db.nextId('cat-'), name: cleanCategoryName(input.name), parentId };
  db.categories.set(category.id, category);
  return { ...category };
}

/** "Outdoor > Grills > Gas". @param {CatalogDb} db @param {string} id */
export function categoryPath(db, id) {
  const names = [];
  for (let c = mustGet(db, id); c; c = c.parentId ? mustGet(db, c.parentId) : null) names.unshift(c.name);
  return names.join(SEP);
}

/** @param {CatalogDb} db @param {string} id */
export function childCategories(db, id) {
  return [...db.categories.values()].filter((c) => c.parentId === id).map((c) => ({ ...c }));
}

/** Admin: rename a category. @param {CatalogDb} db @param {string} id @param {string} name */
export function renameCategory(db, id, name) {
  const category = mustGet(db, id);
  category.name = cleanCategoryName(name);
  return { ...category };
}

/** Admin: move a category (and everything under it) below another parent, or to the top level. @param {CatalogDb} db @param {string} id @param {string | null} parentId */
export function moveCategory(db, id, parentId) {
  const category = mustGet(db, id);
  for (let p = parentId; p; p = mustGet(db, p).parentId) {
    if (p === id) throw new Error('a category cannot be moved below itself');
  }
  category.parentId = parentId;
  return { ...category };
}
