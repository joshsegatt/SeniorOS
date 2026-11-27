# Checkout flow

`placeOrder({ customerId, items: [{ sku, qty }] })` runs these steps in order:

1. **Resolve** every cart line against the catalog. Unknown SKU or a quantity that is not a
   positive integer: `ValidationError` (400).
2. **Reserve stock** for physical items, all or nothing. Not enough stock: `OutOfStockError` (409).
3. **Quote shipping** from the weight of the physical items.
4. **Charge** the customer once for items + shipping (see `payment-gateway.md`).
5. **Plan parcels** for the warehouse (max 30 kg per parcel).
6. **Save** the order with status `paid`.

## Item kinds

- Physical items have `weightGrams` (a positive integer) and stock.
- Digital items (gift cards, e-books) have `digital: true`, **no weight and no stock**. They are
  delivered by email by the mailer, never put into a parcel and never shipped. An order with only
  digital items has shipping 0 and no parcels.

Gift cards (`GIFT-*`) went live on 2026-11-20.

## Money rules

- A customer is charged at most once per checkout. A checkout request must never produce two
  captures, whatever fails.
- Any valid cart (known SKUs, positive quantities, enough stock) must produce a paid order.
