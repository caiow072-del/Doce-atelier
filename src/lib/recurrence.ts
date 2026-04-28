// Compute event occurrences in runtime from a recurring event's master row.
// Recurrence kinds: "none" | "weekly" | "monthly"
// weekly uses `weekday` (0=Sun..6=Sat). monthly uses `day_of_month` (1..31).
// recurrence_until is optional ISO date string (inclusive upper bound).

export type RecurringEvent = {
  date: string; // anchor date (first occurrence)
  recurrence: string;
  recurrence_until: string | null;
  weekday?: number | null;
  day_of_month?: number | null;
};

const DAY_MS = 86_400_000;

/**
 * Parse a date value as LOCAL time, never UTC-shifted.
 * Accepts "YYYY-MM-DD" (from <input type=date>) or full ISO strings.
 * For "YYYY-MM-DD" alone, returns local noon to avoid DST/timezone edge issues.
 */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Plain YYYY-MM-DD → build at local noon
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
  }
  // Full ISO with time → trust it
  return new Date(value);
}

export function getOccurrences(ev: RecurringEvent, from: Date, to: Date): Date[] {
  const start = parseLocalDate(ev.date);
  if (ev.recurrence === "none" || !ev.recurrence) {
    return start >= from && start <= to ? [start] : [];
  }
  const limit = ev.recurrence_until ? new Date(ev.recurrence_until + "T23:59:59") : to;
  const end = limit < to ? limit : to;
  const out: Date[] = [];

  if (ev.recurrence === "weekly") {
    const weekday = ev.weekday ?? start.getDay();
    // start scanning at max(from, start) snapped to next matching weekday
    let cursor = new Date(Math.max(from.getTime(), start.getTime()));
    cursor.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const delta = (weekday - cursor.getDay() + 7) % 7;
    cursor = new Date(cursor.getTime() + delta * DAY_MS);
    while (cursor <= end) {
      out.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
    }
    return out;
  }

  if (ev.recurrence === "monthly") {
    const dom = ev.day_of_month ?? start.getDate();
    let y = Math.max(from.getFullYear(), start.getFullYear());
    let m =
      y === start.getFullYear() && from.getFullYear() === start.getFullYear()
        ? Math.max(from.getMonth(), start.getMonth())
        : from.getMonth();
    if (y < from.getFullYear()) {
      y = from.getFullYear();
      m = from.getMonth();
    }
    while (true) {
      const lastDay = new Date(y, m + 1, 0).getDate();
      const useDay = Math.min(dom, lastDay);
      const occ = new Date(y, m, useDay, start.getHours(), start.getMinutes(), 0, 0);
      if (occ > end) break;
      if (occ >= from && occ >= start) out.push(occ);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      if (y > end.getFullYear() + 1) break; // safety
    }
    return out;
  }

  return [start];
}

export function nextOccurrence(ev: RecurringEvent, after: Date = new Date()): Date | null {
  const horizon = new Date(after.getTime() + 365 * DAY_MS);
  const occs = getOccurrences(ev, after, horizon);
  return occs[0] ?? null;
}

export const WEEKDAYS = [
  { v: 0, label: "Domingo" },
  { v: 1, label: "Segunda" },
  { v: 2, label: "Terça" },
  { v: 3, label: "Quarta" },
  { v: 4, label: "Quinta" },
  { v: 5, label: "Sexta" },
  { v: 6, label: "Sábado" },
];
