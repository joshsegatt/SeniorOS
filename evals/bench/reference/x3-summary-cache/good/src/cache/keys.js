// Every key the app stores in ShopKV.
//
// ShopKV is shared by all app instances and is not flushed on deploy, so values cached by the previous release are
// still there when the new one starts. When the shape or the meaning of a cached value changes, bump the version in
// its key: the new code then never reads entries written by the old code, and those expire on their own.

export const keys = {
  /** @param {string} basketId */
  basketSummary: (basketId) => `basket-summary:v4:${basketId}`,
  /** @param {string} slug */
  productPage: (slug) => `product-page:v7:${slug}`,
  /** @param {string} token */
  session: (token) => `session:${token}`,
};
