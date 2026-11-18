import type { Db } from "./db.js";
import { loadProgress, type HabitRow } from "./progress.js";
import {
  addDays,
  daysShowedUp,
  dueOn,
  faithfulness,
  habitStreak,
  isKept,
  userStreak,
  weekStart,
  type CheckInLite,
} from "./stats.js";

/**
 * Badges are milestones with meaning (7 days = a full week, 40 days = Jesus
 * in the wilderness). They're unlocked once and kept forever.
 */
export const ACHIEVEMENTS = [
  "first_step", // first habit completed
  "perfect_day", // every habit due today completed
  "week", // 7-day streak
  "faithful_little", // 10-day streak on a single habit
  "days_21", // 21-day streak
  "days_40", // 40-day streak
  "days_100", // 100-day streak
  "prayer_warrior", // prayed for friends 10 times
  "challenge_done", // finished a guided challenge
  "reward_reached", // reached a personal reward goal
] as const;
export type AchievementKey = (typeof ACHIEVEMENTS)[number];

type Index = Map<string, CheckInLite>;
const indexOf = (cs: CheckInLite[]): Index => new Map(cs.map((c) => [`${c.habit_id}|${c.date}`, c]));

/** All habits due on a date were kept (and there was at least one). */
export function isPerfectDay(habits: HabitRow[], checkIns: CheckInLite[], date: string): boolean {
  const idx = indexOf(checkIns);
  const due = habits.filter((h) => dueOn(h, date));
  return due.length > 0 && due.every((h) => isKept(h, idx.get(`${h.id}|${date}`)));
}

async function unlock(db: Db, userId: string, keys: AchievementKey[]): Promise<AchievementKey[]> {
  const fresh: AchievementKey[] = [];
  for (const key of keys) {
    const rows = await db.query(
      `INSERT INTO achievements (user_id, key) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING key`,
      [userId, key],
    );
    if (rows.length) fresh.push(key);
  }
  return fresh;
}

/** Checks every badge and reward goal after a check-in; returns what was newly reached. */
export async function evaluate(db: Db, userId: string, date: string) {
  const { habits, checkIns } = await loadProgress(db, userId, date);
  const earned: AchievementKey[] = [];
  if (daysShowedUp(habits, checkIns) >= 1) earned.push("first_step");
  if (isPerfectDay(habits, checkIns, date)) earned.push("perfect_day");
  const { longest } = userStreak(habits, checkIns, date);
  if (longest >= 7) earned.push("week");
  if (longest >= 21) earned.push("days_21");
  if (longest >= 40) earned.push("days_40");
  if (longest >= 100) earned.push("days_100");
  if (habits.some((h) => h.type !== "weekly" && habitStreak(h, checkIns, date) >= 10)) earned.push("faithful_little");

  const [{ n }] = (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM encouragements WHERE from_id = $1 AND type = 'prayer'`,
    [userId],
  )) as [{ n: number }];
  if (n >= 10) earned.push("prayer_warrior");

  // Finished challenges with at least 70% faithfulness.
  const ended = await db.query<{ challenge_key: string; start_date: string; end_date: string }>(
    `SELECT challenge_key, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM user_challenges WHERE user_id = $1 AND end_date < $2::date`,
    [userId, date],
  );
  for (const ch of ended) {
    const hs = (
      await db.query<HabitRow>(
        `SELECT id, category_id, type, target, days_mask, to_char(start_date, 'YYYY-MM-DD') AS start_date,
                to_char(end_date, 'YYYY-MM-DD') AS end_date
           FROM habits WHERE user_id = $1 AND challenge_key = $2`,
        [userId, ch.challenge_key],
      )
    ).filter((h) => h.start_date >= ch.start_date);
    const days = Math.round((Date.parse(ch.end_date) - Date.parse(ch.start_date)) / 86_400_000) + 1;
    const f = hs.length ? faithfulness(hs, checkIns, ch.end_date, days) : null;
    if (f !== null && f >= 70) earned.push("challenge_done");
  }

  const rewards = await evaluateRewards(db, userId, date, habits, checkIns);
  if (rewards.length) earned.push("reward_reached");
  const achievements = await unlock(db, userId, earned);
  return { achievements, rewards, perfectDay: isPerfectDay(habits, checkIns, date) };
}

/** Days counted toward a reward goal: kept days of one habit, or days showed up overall. */
export function rewardProgress(
  goal: { habit_id: string | null; start_date: string },
  habits: HabitRow[],
  checkIns: CheckInLite[],
): number {
  const since = checkIns.filter((c) => c.date >= goal.start_date);
  if (goal.habit_id) {
    const h = habits.find((x) => x.id === goal.habit_id);
    if (!h) return 0;
    return new Set(since.filter((c) => c.habit_id === h.id && isKept(h, c)).map((c) => c.date)).size;
  }
  return daysShowedUp(habits, since);
}

async function evaluateRewards(db: Db, userId: string, _date: string, habits: HabitRow[], checkIns: CheckInLite[]) {
  const goals = await db.query<{ id: string; title: string; habit_id: string | null; target_days: number; start_date: string }>(
    `SELECT id, title, habit_id, target_days, to_char(start_date, 'YYYY-MM-DD') AS start_date
       FROM reward_goals WHERE user_id = $1 AND achieved_at IS NULL`,
    [userId],
  );
  const reached: { id: string; title: string }[] = [];
  for (const g of goals) {
    if (rewardProgress(g, habits, checkIns) >= g.target_days) {
      await db.query(`UPDATE reward_goals SET achieved_at = now() WHERE id = $1`, [g.id]);
      reached.push({ id: g.id, title: g.title });
    }
  }
  return reached;
}

/** Weekly summary (Monday–Sunday) for the recap card. */
export function weekSummary(habits: HabitRow[], checkIns: CheckInLite[], anyDayInWeek: string, today: string) {
  const start = weekStart(anyDayInWeek);
  const end = addDays(start, 6) < today ? addDays(start, 6) : today;
  const idx = indexOf(checkIns);
  const inWeek = checkIns.filter((c) => c.date >= start && c.date <= end);
  const counts = new Map<string, number>();
  for (const c of inWeek) {
    const h = habits.find((x) => x.id === c.habit_id);
    if (!h) continue;
    const kept = h.type === "weekly" ? c.status !== "slipped" && c.value >= 1 : isKept(h, c);
    if (kept) counts.set(h.id, (counts.get(h.id) ?? 0) + 1);
  }
  let perfect = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const due = habits.filter((h) => dueOn(h, d));
    if (due.length && due.every((h) => isKept(h, idx.get(`${h.id}|${d}`)))) perfect++;
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const h = habits.find((x) => x.id === id)!;
      return { id, name: h.name, emoji: h.emoji, count };
    });
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  return {
    start,
    end,
    days_showed_up: daysShowedUp(habits, inWeek),
    completions: [...counts.values()].reduce((a, b) => a + b, 0),
    perfect_days: perfect,
    faithfulness: faithfulness(habits, checkIns, end, days),
    top,
  };
}
