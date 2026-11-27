// Minimal CSV reader for supplier files.
// Returns { header, rows: [{ line, fields }] }.

export function parseCsv(text) {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const header = splitLine(lines[0] ?? '').map((h) => h.trim());
  const rows = lines.slice(1).map((line, i) => ({ line: i + 2, fields: splitLine(line) }));
  return { header, rows };
}

// Splits one line on commas, honouring double quotes and "" escapes.
export function splitLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}
