import { readFileSync } from 'node:fs';
import { parseSwissDate } from '../ledger/dates.js';
import { parseAmount } from '../ledger/money.js';
import { addTransaction } from '../ledger/transactions.js';

const HEADER = ['Date', 'Description', 'Amount', 'Currency'];

/**
 * RFC 4180 rows: quoted fields may hold commas, quotes ("") and line breaks; LF or CRLF line endings.
 * Blank lines are dropped.
 * @param {string} text
 */
function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') endRow();
    else if (c === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
    } else field += c;
  }
  if (quoted) throw new Error('unterminated quoted field');
  endRow();
  return rows;
}

/**
 * Imports a CSV statement exported from Alpstein Bank e-banking. Returns how many transactions it added.
 * The real export starts with a UTF-8 byte order mark, uses CRLF, ends with an empty line, quotes descriptions
 * that contain commas, writes amounts with a ' thousands separator (6'400.00), and is empty for a month
 * without transactions.
 * @param {ReturnType<import('../ledger/store.js').createLedger>} ledger
 * @param {string} file
 */
export function importStatement(ledger, file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text);
  if (rows.length === 0) return 0;
  const [header, ...lines] = rows;
  if (header.length !== HEADER.length || header.some((name, i) => name.trim() !== HEADER[i])) throw new Error('not an Alpstein Bank statement');
  let imported = 0;
  for (const [date, description, amount, currency] of lines) {
    addTransaction(ledger, {
      date: parseSwissDate(date),
      description,
      amountCents: parseAmount(String(amount ?? '').replace(/['’]/g, '')),
      currency: String(currency ?? '').trim(),
      source: 'bank-csv',
    });
    imported += 1;
  }
  return imported;
}
