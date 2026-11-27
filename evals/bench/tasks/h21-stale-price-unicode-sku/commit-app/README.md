# kaffee-shop

Backend of our coffee web shop and the POS tablets in the store.

```
src/
  app.js                 wiring (createShop)
  catalog/sku.js         SKU canonical form
  catalog/catalog.js     products
  import/feed.js         nightly supplier feed (data/supplier-feed.csv)
  pricing/rules.js       net -> gross (VAT, 5 Rappen rounding)
  pricing/priceCache.js  memoized gross prices
  util/keys.js           cache / subscription keys
  web/productPage.js     /p/<sku> page and "notify me"
  cart/cart.js           cart and totals
  alerts/priceAlerts.js  price-drop emails
  admin/updatePrice.js   admin price form
  api/priceApi.js        POS price lookup
  mail/outbox.js         outgoing mail
  format/money.js        CHF helpers
```

SKU rules: case-insensitive, surrounding whitespace ignored, accents
significant (`CAFÉ-CRÈME-250` and `CAFE-CREME-250` are different products).

Prices are cached until a writer invalidates them; the admin form and the
feed import both invalidate.

`npm test` runs the suite.
