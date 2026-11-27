// Minimal RFC 4180 CSV reader.
// - fields separated by ',', records by LF or CRLF
// - a field may be quoted with '"'; inside quotes, '""' is a literal quote and
//   commas / line breaks are part of the value
// - a leading UTF-8 BOM is ignored

const QUOTE = 34;
const COMMA = 44;
const LF = 10;
const CR = 13;

export class CsvError extends Error {
  constructor(message, offset) {
    super(message);
    this.name = 'CsvError';
    this.offset = offset;
  }
}

function bodyStart(text) {
  return text.charCodeAt(0) === 0xfeff ? 1 : 0;
}

// Reads the record that starts at `start`. Returns its fields and the index of
// the first character after its line terminator.
export function readRecord(text, start) {
  const n = text.length;
  const fields = [];
  let i = start;
  for (;;) {
    if (text.charCodeAt(i) === QUOTE) {
      let value = '';
      i++;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q === -1) throw new CsvError('unterminated quoted field', start);
        value += text.slice(i, q);
        if (text.charCodeAt(q + 1) === QUOTE) {
          value += '"';
          i = q + 2;
        } else {
          i = q + 1;
          break;
        }
      }
      fields.push(value);
    } else {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === COMMA || c === LF || (c === CR && text.charCodeAt(j + 1) === LF)) break;
        j++;
      }
      fields.push(text.slice(i, j));
      i = j;
    }

    if (i >= n) return { fields, next: n };
    const c = text.charCodeAt(i);
    if (c === COMMA) {
      i++;
      continue;
    }
    if (c === LF) return { fields, next: i + 1 };
    if (c === CR && text.charCodeAt(i + 1) === LF) return { fields, next: i + 2 };
    throw new CsvError('unexpected character after a quoted field', i);
  }
}

// All records of the file, as arrays of strings. An empty line is a record
// with a single empty field.
export function parseCsv(text) {
  const records = [];
  let pos = bodyStart(text);
  while (pos < text.length) {
    const { fields, next } = readRecord(text, pos);
    records.push(fields);
    pos = next;
  }
  return records;
}

function countLineBreaks(text, from, to) {
  let count = 0;
  for (let i = text.indexOf('\n', from); i !== -1 && i < to; i = text.indexOf('\n', i + 1)) count++;
  return count;
}

// 1-based physical line on which record `index` starts (record 0 = header).
// Quoted values can span several lines, so this walks the records before it.
export function recordStartLine(text, index) {
  let pos = bodyStart(text);
  let line = 1;
  for (let r = 0; r < index; r++) {
    const { next } = readRecord(text, pos);
    line += countLineBreaks(text, pos, next);
    pos = next;
  }
  return line;
}

// 1-based line of a character offset (for error messages).
export function lineAt(text, offset) {
  return 1 + countLineBreaks(text, 0, offset);
}
