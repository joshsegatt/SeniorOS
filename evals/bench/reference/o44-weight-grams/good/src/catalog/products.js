import { kgToGrams, toCents } from './units.js';

/**
 * @typedef {{ sku?: string, title?: string, price?: string, weightKg?: string, hsCode?: string, originCountry?: string, active?: boolean }} ProductForm
 * The admin product form. Staff type prices in euros and weights in kilograms.
 */

/** @param {ProductForm} form */
function fieldsFrom(form) {
  /** @type {Record<string, any>} */
  const fields = {};
  if (form.title !== undefined) {
    if (!String(form.title).trim()) throw new Error('title is required');
    fields.title = String(form.title).trim();
  }
  if (form.price !== undefined) {
    const priceCents = toCents(form.price);
    if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error(`invalid price: ${form.price}`);
    fields.priceCents = priceCents;
  }
  if (form.weightKg !== undefined) {
    const weightGrams = kgToGrams(form.weightKg);
    if (!Number.isInteger(weightGrams) || weightGrams <= 0) throw new Error(`invalid weight: ${form.weightKg}`);
    fields.weightGrams = weightGrams;
  }
  if (form.hsCode !== undefined) fields.hsCode = String(form.hsCode);
  if (form.originCountry !== undefined) fields.originCountry = String(form.originCountry).toUpperCase();
  if (form.active !== undefined) fields.active = Boolean(form.active);
  return fields;
}

/**
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {ProductForm} form
 * @param {() => Date} [now]
 */
export function createProduct(catalog, form, now = () => new Date()) {
  const sku = String(form.sku ?? '').trim().toUpperCase();
  if (!sku) throw new Error('sku is required');
  if (catalog.raw(sku)) throw new Error(`sku already exists: ${sku}`);
  for (const field of ['title', 'price', 'weightKg']) if (form[field] === undefined) throw new Error(`${field} is required`);
  catalog.put({ sku, active: true, ...fieldsFrom(form), updatedAt: now().toISOString() });
  return catalog.get(sku);
}

/**
 * Saves the fields present in the form; the others keep their saved value.
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {string} sku
 * @param {ProductForm} form
 * @param {() => Date} [now]
 */
export function updateProduct(catalog, sku, form, now = () => new Date()) {
  const saved = catalog.raw(sku);
  if (!saved) throw new Error(`unknown sku: ${sku}`);
  const fields = fieldsFrom(form);
  const { weightKg, ...rest } = saved;
  // A record saved before weightGrams keeps its weightKg until its weight is edited.
  const record = fields.weightGrams === undefined ? saved : rest;
  catalog.put({ ...record, ...fields, updatedAt: now().toISOString() });
  return catalog.get(sku);
}
