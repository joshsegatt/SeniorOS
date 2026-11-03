import { readFileSync } from 'node:fs';

/**
 * Shop settings from config/shop.json.
 * @type {{ name: string, supportEmail: string, freeShippingFromCents: number, shop: { address: string, openingHours: string } }}
 */
export const shop = JSON.parse(readFileSync(new URL('../config/shop.json', import.meta.url), 'utf8'));
