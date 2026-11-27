// Lookup keys for in-process caches and subscription maps.
// Keys must not depend on how a caller happened to type the SKU.

export function cacheKey(sku) {
  return String(sku).trim().toUpperCase();
}

export function scopedKey(scope, sku) {
  return `${scope}:${cacheKey(sku)}`;
}
