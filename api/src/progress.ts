import type { Db } from "./db.js";
import { addDays, type CheckInLite, type HabitLite } from "./stats.js";

export const HABIT_COLUMNS = `id, category_id, name, type, target, unit, days_mask, reminder_time, reminders, share_name, archived, sort,
  emoji, color, why, part_of_day, challenge_key,
  to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, created_at`;

export type HabitRow = HabitLite & {
  name: string;
  unit: string;
  reminder_time: string | null;
  reminders: string[];
  share_name: boolean;
  sort: number;
  emoji: string;
  color: string;
  why: string;
  part_of_day: string;
  challenge_key: string | null;
};

/** Active habits plus the last ~400 days of check-ins for one user. */
export async function loadProgress(db: Db, userId: string, today: string) {
  const habits = await db.query<HabitRow>(
    `SELECT ${HABIT_COLUMNS} FROM habits WHERE user_id = $1 AND NOT archived ORDER BY sort, created_at`,
    [userId],
  );
  const checkIns = await db.query<CheckInLite & { note: string }>(
    `SELECT habit_id, to_char(date, 'YYYY-MM-DD') AS date, value, status, note FROM check_ins
      WHERE user_id = $1 AND date >= $2::date AND date <= $3::date`,
    [userId, addDays(today, -400), today],
  );
  return { habits, checkIns };
}
