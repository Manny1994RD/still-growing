/**
 * Pure progress calculations: grace streaks, faithfulness, growth seasons.
 * Dates are ISO strings (YYYY-MM-DD) in the user's local calendar; the client
 * always sends its own "today" so time zones never shift a day.
 */

export type HabitType = "do" | "count" | "time" | "weekly" | "refrain";

export interface HabitLite {
  id: string;
  category_id: string;
  type: HabitType;
  target: number;
  days_mask: number;
  start_date: string;
  /** Last day for habits created by a time-limited challenge. */
  end_date?: string | null;
}

export interface CheckInLite {
  habit_id: string;
  date: string;
  value: number;
  status: "done" | "rest" | "slipped";
}

export const SEASONS = ["seed", "sprout", "rooted", "fruitful", "overflowing"] as const;
export type Season = (typeof SEASONS)[number];

// ---------- date helpers (UTC arithmetic on calendar dates) ----------
const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
export const weekday = (d: string) => new Date(toMs(d)).getUTCDay(); // 0 = Sunday
/** Monday that starts the week containing d. Grace resets every Monday. */
export const weekStart = (d: string) => addDays(d, -((weekday(d) + 6) % 7));
export const isScheduledDay = (mask: number, d: string) => (mask & (1 << weekday(d))) !== 0;

export function isDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toMs(s));
}

// ---------- core predicates ----------
type Index = Map<string, CheckInLite>; // key: habitId|date
const key = (h: string, d: string) => `${h}|${d}`;
const index = (checkIns: CheckInLite[]): Index => new Map(checkIns.map((c) => [key(c.habit_id, c.date), c]));

/** A check-in "keeps" a day when the goal is reached or it was a planned rest day. */
export function isKept(habit: HabitLite, c: CheckInLite | undefined): boolean {
  if (!c) return false;
  if (c.status === "rest") return true;
  if (c.status === "slipped") return false;
  const goal = habit.type === "count" || habit.type === "time" ? habit.target : 1;
  return c.value >= goal;
}

/** Whether a habit exists on a date (started and not yet ended). */
export const activeOn = (h: HabitLite, d: string) => d >= h.start_date && (!h.end_date || d <= h.end_date);

/** Daily habits are due on their scheduled weekdays; weekly habits are scored per week. */
export const dueOn = (h: HabitLite, d: string) => h.type !== "weekly" && activeOn(h, d) && isScheduledDay(h.days_mask, d);

function weeklyDoneCount(h: HabitLite, wkStart: string, idx: Index, upTo: string): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(wkStart, i);
    if (d > upTo) break;
    const c = idx.get(key(h.id, d));
    if (c && (c.status === "done" || c.status === "rest") && c.value >= 1) n++;
  }
  return n;
}

// ---------- user-level ----------
function showedUp(habits: HabitLite[], idx: Index, d: string): boolean {
  return habits.some((h) => {
    const c = idx.get(key(h.id, d));
    if (!c) return false;
    return h.type === "weekly" ? c.status !== "slipped" && c.value >= 1 : isKept(h, c);
  });
}

function anythingScheduled(habits: HabitLite[], d: string): boolean {
  return habits.some((h) => activeOn(h, d) && (h.type === "weekly" || isScheduledDay(h.days_mask, d)));
}

/**
 * Grace streak: consecutive days the user showed up for at least one habit.
 * One missed day per week (Mon–Sun) is covered by grace and does not break it.
 * Today only adds to the streak once it is kept — an unfinished today never breaks it.
 */
export function userStreak(habits: HabitLite[], checkIns: CheckInLite[], today: string) {
  const idx = index(checkIns);
  const earliest = habits.reduce((m, h) => (h.start_date < m ? h.start_date : m), today);
  const graceWeeks = new Set<string>();
  let current = 0;
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    if (!anythingScheduled(habits, d)) continue;
    if (showedUp(habits, idx, d)) {
      current++;
    } else if (d === today) {
      continue;
    } else if (!graceWeeks.has(weekStart(d))) {
      graceWeeks.add(weekStart(d));
    } else {
      break;
    }
  }

  // Longest streak: forward pass with the same rules.
  let longest = 0;
  let run = 0;
  const fwdGrace = new Set<string>();
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (!anythingScheduled(habits, d)) continue;
    if (showedUp(habits, idx, d)) {
      run++;
    } else if (d === today) {
      continue;
    } else if (!fwdGrace.has(weekStart(d))) {
      fwdGrace.add(weekStart(d));
    } else {
      run = 0;
      fwdGrace.clear();
      fwdGrace.add(weekStart(d)); // this week's grace is spent by the day that broke it
    }
    longest = Math.max(longest, run);
  }

  return {
    current,
    longest: Math.max(longest, current),
    graceUsedThisWeek: graceWeeks.has(weekStart(today)),
  };
}

/** Per-habit streak. Daily habits count days, weekly habits count weeks met. */
export function habitStreak(h: HabitLite, checkIns: CheckInLite[], today: string): number {
  const idx = index(checkIns);
  if (h.type === "weekly") {
    let n = 0;
    for (let wk = weekStart(today); wk >= weekStart(h.start_date); wk = addDays(wk, -7)) {
      const met = weeklyDoneCount(h, wk, idx, today) >= h.target;
      if (met) n++;
      else if (wk === weekStart(today)) continue; // current week still in progress
      else break;
    }
    return n;
  }
  const graceWeeks = new Set<string>();
  let n = 0;
  for (let d = today; d >= h.start_date; d = addDays(d, -1)) {
    if (!dueOn(h, d)) continue;
    const c = idx.get(key(h.id, d));
    if (isKept(h, c)) n++;
    else if (d === today && !c) continue;
    else if (c?.status === "slipped") break; // a slip on a refrain habit always resets its run
    else if (!graceWeeks.has(weekStart(d))) graceWeeks.add(weekStart(d));
    else break;
  }
  return n;
}

/**
 * Faithfulness: share of due habit-days (and weekly goals) kept in the last
 * `windowDays` days. Today only counts once it is kept. Returns null when
 * nothing was due yet.
 */
export function faithfulness(habits: HabitLite[], checkIns: CheckInLite[], today: string, windowDays = 30) {
  const idx = index(checkIns);
  const from = addDays(today, -(windowDays - 1));
  let due = 0;
  let kept = 0;
  for (const h of habits) {
    if (h.type === "weekly") {
      for (let wk = weekStart(from); wk <= today; wk = addDays(wk, 7)) {
        if (addDays(wk, 6) < h.start_date || (h.end_date && wk > h.end_date)) continue;
        const met = weeklyDoneCount(h, wk, idx, today) >= h.target;
        const inProgress = wk === weekStart(today);
        if (inProgress && !met) continue;
        due++;
        if (met) kept++;
      }
      continue;
    }
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (!dueOn(h, d)) continue;
      const k = isKept(h, idx.get(key(h.id, d)));
      if (d === today && !k) continue;
      due++;
      if (k) kept++;
    }
  }
  return due === 0 ? null : Math.round((kept / due) * 100);
}

export function daysShowedUp(habits: HabitLite[], checkIns: CheckInLite[]): number {
  const idx = index(checkIns);
  const dates = new Set(checkIns.map((c) => c.date));
  let n = 0;
  for (const d of dates) if (showedUp(habits, idx, d)) n++;
  return n;
}

export function seasonFor(days: number, faith: number | null): Season {
  const f = faith ?? 0;
  if (days >= 120 && f >= 80) return "overflowing";
  if (days >= 60 && f >= 75) return "fruitful";
  if (days >= 21 && f >= 70) return "rooted";
  if (days >= 7) return "sprout";
  return "seed";
}

/** Seasons never go backwards. */
export const higherSeason = (a: Season, b: Season): Season =>
  SEASONS.indexOf(a) >= SEASONS.indexOf(b) ? a : b;

/** Per-day completion for the growth calendar: how many due habits were kept. */
export function history(habits: HabitLite[], checkIns: CheckInLite[], today: string, days = 35) {
  const idx = index(checkIns);
  const out: { date: string; due: number; kept: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    let due = 0;
    let kept = 0;
    for (const h of habits) {
      if (!dueOn(h, d)) continue;
      due++;
      if (isKept(h, idx.get(key(h.id, d)))) kept++;
    }
    out.push({ date: d, due, kept });
  }
  return out;
}

export { weeklyDoneCount as _weeklyDoneCount, index as _index };
