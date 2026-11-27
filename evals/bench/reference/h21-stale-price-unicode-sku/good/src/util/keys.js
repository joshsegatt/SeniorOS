import { canonicalSku } from '../catalog/sku.js';

// Lookup keys for in-process caches and subscription maps.
// Keys must not depend on how a caller happened to type the SKU, so they use
// the catalog's canonical form (NFC + trim + upper case). Without NFC, the
// decomposed SKUs from the supplier feed and the composed ones typed by staff
// landed on different keys: invalidations and alerts missed each other.

export function cacheKey(sku) {
  return canonicalSku(String(sku));
}

export function scopedKey(scope, sku) {
  return `${scope}:${cacheKey(sku)}`;
}
