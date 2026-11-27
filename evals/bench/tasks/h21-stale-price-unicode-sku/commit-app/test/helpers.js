import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createShop } from '../src/app.js';

export const FEED = readFileSync(fileURLToPath(new URL('../data/supplier-feed.csv', import.meta.url)), 'utf8');

export function shopWithFeed(text = FEED) {
  const shop = createShop();
  shop.importFeed(text);
  return shop;
}
