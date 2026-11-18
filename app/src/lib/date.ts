const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD (never UTC, so late-night check-ins land on the right day). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function prettyDate(s: string): string {
  return parseDate(s).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function greetingFor(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function scheduleLabel(mask: number): string {
  if (mask === 127) return "Every day";
  if (mask === 0b0111110) return "Weekdays";
  if (mask === 0b1000001) return "Weekends";
  return WEEKDAY_NAMES.filter((_, i) => mask & (1 << i)).join(" · ");
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h!, m!, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
