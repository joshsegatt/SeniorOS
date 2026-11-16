# #218 Back-in-stock emails

**Owner:** Mira (product) · **Status:** ready for dev · **Target:** sprint 47

## Why

Sold-out product pages are some of our most visited pages, and today people land there and leave. Support answers
about 40 "when is the linen apron back?" emails a week and has no way to follow up. We want customers to leave their
email on a sold-out product and hear from us the moment it's back.

## What we want

1. **Sign-up.** On a sold-out product page the customer can enter their email under "Email me when it's back".
   Backend: `subscribeBackInStock(store, sku, email, now)` in `src/shop/back-in-stock.js`, returning the sign-up. We
   save the address trimmed and in lower case, and anything that isn't an email address is rejected with
   "invalid email".
2. **Only for sold-out products.** Signing up for a product that is in stock fails with "product is in stock"
   (the form isn't shown there anyway, but the endpoint is public). An unknown product fails like it does elsewhere.
3. **No duplicates.** Signing up again for the same product with the same address (any capitalisation, stray spaces)
   keeps the one sign-up and returns it, so nobody gets two emails.
4. **The email.** When the product is back in stock (the warehouse books in a delivery, or someone corrects the count
   in the admin after a stock take), everyone waiting gets one `back-in-stock` email, in the order they signed up.
   The template already exists in the email service; it needs `sku`, `title` and `url` (the product page link,
   `productUrl`) in its data. Other products' sign-ups aren't touched.
5. **One email per sign-up.** Once someone has been emailed, their sign-up is done: if the product sells out and
   comes back again later, they don't get another email unless they signed up again.
6. **Admin.** The admin product screen shows how many people are waiting (`waiting` in `productAdminView`), so the
   buying team can see demand when they reorder.
7. **Product page.** `productPage` tells the storefront whether to show the form: `notifyMe` is true on a sold-out
   product and false otherwise.

## Notes

- Copy and the email layout are final in Figma (frame "BIS / email v3"); nothing to do on our side for the template.
- No SMS for now, and no "notify me" for products that are only out in one size; we'll revisit after launch.
- Legal reviewed this: a sign-up is consent for one specific email, and we may keep it for 90 days at most. A sign-up
  older than that when the product comes back is dropped, not emailed.
- Analytics (sign-ups per product, conversion from the email) is a follow-up ticket, #224.
