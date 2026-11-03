/**
 * Local dev data with the same shape and volume as production (about 6,000 products from 350 suppliers).
 * @param {{ products?: number, suppliers?: number }} [size]
 */
export function seedCollections({ products = 6000, suppliers = 350 } = {}) {
  const supplierDocs = Array.from({ length: suppliers }, (_, i) => ({
    id: `sup-${i + 1}`,
    name: `Supplier ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
    email: `orders@supplier${i + 1}.example`,
  }));
  const productDocs = Array.from({ length: products }, (_, i) => ({
    sku: `SKU-${String(i + 1).padStart(5, '0')}`,
    name: `Product ${i + 1}`,
    active: i % 10 !== 9,
    supplierId: supplierDocs[(i * 7) % suppliers].id,
    reorderPoint: 5 + (i % 20),
  }));
  // Some products have never been stocked and have no stock document yet.
  const stockDocs = productDocs.filter((_, i) => i % 17 !== 0).map((p, i) => ({ sku: p.sku, onHand: (i * 13) % 60 }));
  return { products: productDocs, stock: stockDocs, suppliers: supplierDocs };
}
