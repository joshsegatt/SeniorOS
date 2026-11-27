// RFC 4180 CSV reader for supplier files (Excel exports).
// Returns { header, rows: [{ line, fields }] } where `line` is the physical,
// 1-based line where the row starts (header = 1), counting blank lines and
// line breaks inside quoted fields. Handles a leading BOM and CRLF.

export function parseCsv(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records = readRecords(source).filter(
    (record) => !(record.fields.length === 1 && record.fields[0].trim() === ''),
  );
  const [first, ...rows] = records;
  const header = (first?.fields ?? []).map((h) => h.trim());
  return { header, rows };
}

function readRecords(text) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let start = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      fields.push(field);
      records.push({ line: start, fields });
      fields = [];
      field = '';
      line++;
      start = line;
    } else {
      field += ch;
    }
  }
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    records.push({ line: start, fields });
  }
  return records;
}
