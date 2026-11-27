// Usage: npm run import -- path/to/supplier.csv
import { readFile } from 'node:fs/promises';
import { importProducts } from '../src/importer.js';
import { Catalog } from '../src/catalog.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run import -- <file.csv>');
  process.exit(2);
}

const catalog = new Catalog();
const result = importProducts(await readFile(file, 'utf8'), { catalog });
console.log(JSON.stringify(result, null, 2));
