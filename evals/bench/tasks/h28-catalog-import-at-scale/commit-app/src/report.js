// Human-readable summary shown in the admin UI after an import.
export function formatReport({ stats, errors }, { maxErrors = 20 } = {}) {
  const lines = [
    `${stats.created} created, ${stats.updated} updated, ${stats.duplicates} duplicate rows, ${stats.errors} rejected`,
  ];
  for (const err of errors.slice(0, maxErrors)) {
    lines.push(`  line ${err.line}${err.sku ? ` (${err.sku})` : ''}: ${err.message}`);
  }
  if (errors.length > maxErrors) lines.push(`  ... and ${errors.length - maxErrors} more`);
  return lines.join('\n');
}
