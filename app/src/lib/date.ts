import type { Dict } from "@/i18n/en";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD (never UTC, so late-night check-ins land on the right day). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function prettyDate(s: string, locale: string): string {
  return parseDate(s).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
}

export function greetingFor(t: Dict, d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return t.today.morning;
  if (h < 18) return t.today.afternoon;
  return t.today.evening;
}

export function scheduleLabel(mask: number, t: Dict): string {
  if (mask === 127) return t.schedule.everyDay;
  if (mask === 0b0111110) return t.schedule.weekdays;
  if (mask === 0b1000001) return t.schedule.weekends;
  return t.schedule.short.filter((_, i) => mask & (1 << i)).join(" · ");
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function formatTime(t: string, locale: string): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h!, m!, 0, 0);
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** Add days to a local YYYY-MM-DD date. */
export function addDaysLocal(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
