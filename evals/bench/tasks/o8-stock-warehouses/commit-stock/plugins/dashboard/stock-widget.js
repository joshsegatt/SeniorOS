// Back-office dashboard tile (dashboard team). Fed with the stock report JSON.

/** @param {any} report */
export function stockWidget(report) {
  const when = report.generatedAt.slice(11, 16);
  return {
    title: 'Stock',
    value: report.lowStock,
    caption: report.lowStock === 0 ? `All stocked (as of ${when} UTC)` : `${report.lowStock} low on stock (as of ${when} UTC)`,
    tone: report.lowStock === 0 ? 'ok' : 'warn',
  };
}
