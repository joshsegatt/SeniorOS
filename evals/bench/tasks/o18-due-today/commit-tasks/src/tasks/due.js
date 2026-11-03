import { addDays, dayInZone, isDay, startOfDayInZone, weekday } from './days.js';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Reads a "due: ..." line from a forwarded email: "due: today", "due: tomorrow", "due: friday",
 * "due: 14 Oct", "due: Oct 14" or "due: 2026-10-14". Returns the start of that day in the user's
 * time zone, or null when the email names no due day.
 * @param {string} body
 * @param {string} receivedAt ISO timestamp
 * @param {string} timeZone
 * @returns {Date | null}
 */
export function parseDue(body, receivedAt, timeZone) {
  const match = /^\s*due:\s*(.+?)\s*$/im.exec(String(body ?? ''));
  if (!match) return null;
  const today = dayInZone(receivedAt, timeZone);
  const day = resolveDay(match[1].toLowerCase(), today);
  return day ? startOfDayInZone(day, timeZone) : null;
}

/** @param {string} text @param {string} today */
function resolveDay(text, today) {
  if (text === 'today') return today;
  if (text === 'tomorrow') return addDays(today, 1);
  if (isDay(text)) return text;
  const wd = WEEKDAYS.indexOf(text);
  if (wd >= 0) return addDays(today, ((wd - weekday(today) + 7) % 7) || 7);
  const m = /^(\d{1,2})\s+([a-z]{3})[a-z]*$/.exec(text) ?? /^([a-z]{3})[a-z]*\s+(\d{1,2})$/.exec(text);
  if (!m) return null;
  const [dayOfMonth, mon] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
  const month = MONTHS.indexOf(mon);
  if (month < 0 || dayOfMonth < 1 || dayOfMonth > 31) return null;
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  if (!isDay(candidate)) return null;
  return candidate < today ? `${year + 1}${candidate.slice(4)}` : candidate;
}
