/**
 * The iCalendar feed users subscribe to from Google Calendar / Outlook: one all-day VTODO per open
 * task with a due day.
 * @param {import('./store.js').Task[]} tasks
 */
export function calendarFeed(tasks) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bench-shop//tasks//EN'];
  for (const t of tasks) {
    if (t.done || t.dueDate === null) continue;
    lines.push('BEGIN:VTODO', `UID:${t.id}@tasks.bench-shop`, `SUMMARY:${escapeText(t.title)}`, `DUE;VALUE=DATE:${t.dueDate.replaceAll('-', '')}`, 'END:VTODO');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** @param {string} text */
function escapeText(text) {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}
