import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Db } from "./db.js";
import { createChallenges } from "./challenges.js";
import { createCircle } from "./circle.js";
import { sendMail } from "./mail.js";
import { ACHIEVEMENTS, evaluate, rewardProgress, weekSummary } from "./rewards.js";
import { HABIT_COLUMNS, loadProgress } from "./progress.js";
import { randomInt } from "node:crypto";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth.js";
import { MILESTONES, asLang, content, dailyWords, pickMessage, verseOfDay, type Lang } from "./content.js";
import {
  addDays,
  daysShowedUp,
  faithfulness,
  habitStreak,
  higherSeason,
  history,
  isDateString,
  activeOn,
  isScheduledDay,
  seasonFor,
  userStreak,
  weekStart,
  _weeklyDoneCount,
  _index,
  type CheckInLite,
  type HabitLite,
  type Season,
} from "./stats.js";

type Env = { Variables: { userId: string } };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const date = z.string().refine(isDateString, "Use YYYY-MM-DD");

const credentials = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const profilePatch = z
  .object({
    name: z.string().trim().max(60),
    tone: z.enum(["gentle", "scripture", "coach"]),
    vision: z.string().trim().max(500),
    identity_statement: z.string().trim().max(300),
    morning_time: time,
    evening_time: time,
    onboarded: z.boolean(),
    language: z.enum(["en", "es"]),
  })
  .partial();

const habitInput = z.object({
  category_id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["do", "count", "time", "weekly", "refrain"]),
  target: z.number().int().min(1).max(1000).default(1),
  unit: z.string().trim().max(24).default(""),
  days_mask: z.number().int().min(1).max(127).default(127),
  reminder_time: time.nullable().default(null),
  reminders: z.array(time).max(12).optional(),
  share_name: z.boolean().default(false),
  sort: z.number().int().default(0),
  start_date: date.optional(),
  emoji: z.string().max(16).default(""),
  color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).default(""),
  why: z.string().trim().max(200).default(""),
  part_of_day: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
});
const habitPatch = habitInput.partial().extend({ archived: z.boolean().optional() });

/** One list of reminder times; reminder_time mirrors the first one for older apps. */
function normalizeReminders(h: { reminders?: string[]; reminder_time?: string | null }) {
  const list = h.reminders ?? (h.reminder_time ? [h.reminder_time] : []);
  const unique = [...new Set(list)].sort();
  return { reminders: unique, reminder_time: unique[0] ?? null };
}

const checkInInput = z.object({
  habit_id: z.uuid(),
  date,
  value: z.number().int().min(0).max(100_000).default(1),
  status: z.enum(["done", "rest", "slipped"]).default("done"),
  note: z.string().trim().max(300).optional(),
});

const reflectionInput = z.object({
  date,
  type: z.enum(["evening", "ping", "missed_reason"]),
  answers: z.record(z.string(), z.string().max(1000)),
});

const USER_COLUMNS = `id, email, name, tone, vision, identity_statement, morning_time, evening_time, onboarded, season, language,
  friend_code, circle_enabled, share_identity, share_struggling, allow_messages, created_at`;

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Body must be JSON" });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HTTPException(400, { message: `${issue?.path.join(".") || "body"}: ${issue?.message}` });
  }
  return parsed.data;
}

function todayParam(c: Context, name = "date"): string {
  const d = c.req.query(name);
  if (d === undefined) return new Date().toISOString().slice(0, 10);
  if (!isDateString(d)) throw new HTTPException(400, { message: `${name} must be YYYY-MM-DD` });
  return d;
}

export function createApp(db: Db) {
  const app = new Hono<Env>();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        const allowed = (process.env.CORS_ORIGIN ?? "*").split(",").map((s) => s.trim());
        return allowed.includes("*") || allowed.includes(origin) ? origin || "*" : null;
      },
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
  });

  app.get("/health", async (c) => {
    await db.query("SELECT 1");
    return c.json({ ok: true });
  });

  // ---------- auth ----------
  app.post("/auth/register", async (c) => {
    const { email, password, name, language } = await body(
      c,
      credentials.extend({ name: z.string().trim().max(60).default(""), language: z.enum(["en", "es"]).default("en") }),
    );
    const existing = await db.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (existing.length) throw new HTTPException(409, { message: "An account with this email already exists" });
    const [user] = await db.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, language) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
      [email, await hashPassword(password), name, language],
    );
    return c.json({ token: await signToken(user!.id), user }, 201);
  });

  app.post("/auth/login", async (c) => {
    const { email, password } = await body(c, credentials);
    const [row] = await db.query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [email],
    );
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw new HTTPException(401, { message: "Email or password is incorrect" });
    }
    const [user] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [row.id]);
    return c.json({ token: await signToken(row.id), user });
  });

  // ---------- forgot password ----------
  // A 6-digit code is emailed (or written to the server log when email isn't set up).
  app.post("/auth/forgot", async (c) => {
    const { email } = await body(c, z.object({ email: z.email().transform((e) => e.toLowerCase()) }));
    const [user] = await db.query<{ id: string; language: string }>(`SELECT id, language FROM users WHERE email = $1`, [email]);
    if (user) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      await db.query(
        `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts) VALUES ($1, $2, now() + interval '30 minutes', 0)
         ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0`,
        [user.id, await hashPassword(code)],
      );
      const es = user.language === "es";
      await sendMail(
        email,
        es ? "Tu código de Still Growing" : "Your Still Growing code",
        es
          ? `Tu código para restablecer la contraseña es: ${code}\nVence en 30 minutos.`
          : `Your password reset code is: ${code}\nIt expires in 30 minutes.`,
      ).catch((e) => console.error("[mail] failed:", e));
    }
    // Same answer either way so nobody can check which emails have accounts.
    return c.json({ ok: true });
  });

  app.post("/auth/reset", async (c) => {
    const input = await body(
      c,
      z.object({
        email: z.email().transform((e) => e.toLowerCase()),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().min(8, "Password must be at least 8 characters").max(200),
      }),
    );
    const invalid = new HTTPException(400, { message: "That code is invalid or expired" });
    const [row] = await db.query<{ user_id: string; code_hash: string; attempts: number; expired: boolean }>(
      `SELECT r.user_id, r.code_hash, r.attempts, r.expires_at < now() AS expired
         FROM password_resets r JOIN users u ON u.id = r.user_id WHERE u.email = $1`,
      [input.email],
    );
    if (!row || row.expired || row.attempts >= 5) throw invalid;
    if (!(await verifyPassword(input.code, row.code_hash))) {
      await db.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1`, [row.user_id]);
      throw invalid;
    }
    await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [row.user_id, await hashPassword(input.password)]);
    await db.query(`DELETE FROM password_resets WHERE user_id = $1`, [row.user_id]);
    const [user] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [row.user_id]);
    return c.json({ token: await signToken(row.user_id), user });
  });

  // Everything below requires a valid token.
  const authed = new Hono<Env>();
  authed.use("*", async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const userId = header.startsWith("Bearer ") ? await verifyToken(header.slice(7)) : null;
    if (!userId) throw new HTTPException(401, { message: "Please sign in" });
    const [exists] = await db.query(`SELECT 1 FROM users WHERE id = $1`, [userId]);
    if (!exists) throw new HTTPException(401, { message: "Please sign in" });
    c.set("userId", userId);
    await next();
  });

  // ---------- profile ----------
  authed.get("/me", async (c) => {
    const [user] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [c.get("userId")]);
    return c.json({ user });
  });

  authed.patch("/me", async (c) => {
    const patch = await body(c, profilePatch);
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length) {
      const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
      await db.query(`UPDATE users SET ${sets} WHERE id = $1`, [c.get("userId"), ...entries.map(([, v]) => v)]);
    }
    const [user] = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [c.get("userId")]);
    return c.json({ user });
  });

  authed.delete("/me", async (c) => {
    await db.query(`DELETE FROM users WHERE id = $1`, [c.get("userId")]);
    return c.body(null, 204);
  });

  // ---------- categories ----------
  authed.get("/categories", async (c) => {
    const categories = await db.query(
      `SELECT id, name, icon, private_by_default, user_id IS NOT NULL AS custom
         FROM categories WHERE user_id IS NULL OR user_id = $1 ORDER BY sort, name`,
      [c.get("userId")],
    );
    return c.json({ categories });
  });

  authed.post("/categories", async (c) => {
    const { name, icon } = await body(
      c,
      z.object({ name: z.string().trim().min(1).max(40), icon: z.string().max(32).default("circle") }),
    );
    const [category] = await db.query(
      `INSERT INTO categories (id, user_id, name, icon, sort) VALUES ('c_' || replace(gen_random_uuid()::text, '-', ''), $1, $2, $3, 50)
       RETURNING id, name, icon, private_by_default, true AS custom`,
      [c.get("userId"), name, icon],
    );
    return c.json({ category }, 201);
  });

  authed.delete("/categories/:id", async (c) => {
    const id = c.req.param("id");
    const [used] = await db.query(`SELECT 1 FROM habits WHERE category_id = $1 LIMIT 1`, [id]);
    if (used) throw new HTTPException(409, { message: "Move or delete the habits in this category first" });
    const rows = await db.query(`DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id`, [id, c.get("userId")]);
    if (!rows.length) throw new HTTPException(404, { message: "Category not found" });
    return c.body(null, 204);
  });

  async function assertCategory(userId: string, categoryId: string) {
    const [ok] = await db.query(`SELECT 1 FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`, [
      categoryId,
      userId,
    ]);
    if (!ok) throw new HTTPException(400, { message: "Unknown category" });
  }

  // ---------- habits ----------
  authed.get("/habits", async (c) => {
    const includeArchived = c.req.query("archived") === "true";
    const habits = await db.query(
      `SELECT ${HABIT_COLUMNS} FROM habits WHERE user_id = $1 ${includeArchived ? "" : "AND NOT archived"} ORDER BY sort, created_at`,
      [c.get("userId")],
    );
    return c.json({ habits });
  });

  authed.post("/habits", async (c) => {
    const h = await body(c, habitInput);
    await assertCategory(c.get("userId"), h.category_id);
    const target = h.type === "do" || h.type === "refrain" ? 1 : h.target;
    const r = normalizeReminders(h);
    const [habit] = await db.query(
      `INSERT INTO habits (user_id, category_id, name, type, target, unit, days_mask, reminder_time, reminders, share_name, sort, start_date,
                           emoji, color, why, part_of_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, COALESCE($12::date, CURRENT_DATE), $13, $14, $15, $16)
       RETURNING ${HABIT_COLUMNS}`,
      [c.get("userId"), h.category_id, h.name, h.type, target, h.unit, h.days_mask, r.reminder_time, JSON.stringify(r.reminders),
       h.share_name, h.sort, h.start_date ?? null, h.emoji, h.color, h.why, h.part_of_day],
    );
    return c.json({ habit }, 201);
  });

  authed.patch("/habits/:id", async (c) => {
    const raw = await body(c, habitPatch);
    if (raw.category_id) await assertCategory(c.get("userId"), raw.category_id);
    const patch: Record<string, unknown> = { ...raw };
    if (raw.reminders !== undefined || raw.reminder_time !== undefined) {
      const r = normalizeReminders(raw);
      patch.reminders = JSON.stringify(r.reminders);
      patch.reminder_time = r.reminder_time;
    }
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length) {
      const sets = entries.map(([k], i) => `${k} = $${i + 3}${k === "reminders" ? "::jsonb" : ""}`).join(", ");
      const rows = await db.query(`UPDATE habits SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING id`, [
        c.req.param("id"),
        c.get("userId"),
        ...entries.map(([, v]) => v),
      ]);
      if (!rows.length) throw new HTTPException(404, { message: "Habit not found" });
    }
    const [habit] = await db.query(`SELECT ${HABIT_COLUMNS} FROM habits WHERE id = $1 AND user_id = $2`, [
      c.req.param("id"),
      c.get("userId"),
    ]);
    if (!habit) throw new HTTPException(404, { message: "Habit not found" });
    return c.json({ habit });
  });

  /** Save a new order for the habit list: { ids: [...] } top to bottom. */
  authed.post("/habits/order", async (c) => {
    const { ids } = await body(c, z.object({ ids: z.array(z.uuid()).max(200) }));
    for (const [i, id] of ids.entries()) {
      await db.query(`UPDATE habits SET sort = $3 WHERE id = $1 AND user_id = $2`, [id, c.get("userId"), i]);
    }
    return c.body(null, 204);
  });

  authed.delete("/habits/:id", async (c) => {
    const rows = await db.query(`DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id`, [
      c.req.param("id"),
      c.get("userId"),
    ]);
    if (!rows.length) throw new HTTPException(404, { message: "Habit not found" });
    return c.body(null, 204);
  });

  // ---------- progress data ----------
  const load = (userId: string, today: string) => loadProgress(db, userId, today);

  async function profile(userId: string) {
    const [u] = await db.query<{ name: string; season: Season; language: string }>(
      `SELECT name, season, language FROM users WHERE id = $1`,
      [userId],
    );
    return { ...u!, lang: asLang(u!.language) as Lang };
  }

  authed.get("/today", async (c) => {
    const today = todayParam(c);
    const userId = c.get("userId");
    const { habits, checkIns } = await load(userId, today);
    const idx = _index(checkIns);
    const me = await profile(userId);
    const items = habits
      .filter((h) => activeOn(h, today) && (h.type === "weekly" || isScheduledDay(h.days_mask, today)))
      .map((h) => ({
        ...h,
        check_in: idx.get(`${h.id}|${today}`) ?? null,
        week_done: h.type === "weekly" ? _weeklyDoneCount(h, weekStart(today), idx, today) : null,
        streak: habitStreak(h, checkIns, today),
        days_free: h.type === "refrain" ? checkIns.filter((x) => x.habit_id === h.id && x.status === "done").length : null,
      }));
    return c.json({
      date: today,
      verse: verseOfDay(today, me.lang),
      words: dailyWords(today, me.lang),
      greeting: pickMessage("morning", { lang: me.lang, name: me.name, seed: Number(today.replaceAll("-", "")) }),
      habits: items,
    });
  });

  authed.put("/checkins", async (c) => {
    const input = await body(c, checkInInput);
    const userId = c.get("userId");
    // You can catch up on the past week, but not log the future.
    const serverToday = new Date().toISOString().slice(0, 10);
    if (input.date > addDays(serverToday, 1) || input.date < addDays(serverToday, -8)) {
      throw new HTTPException(400, { message: "You can only log the last 7 days" });
    }
    const [habit] = await db.query<HabitLite>(`SELECT ${HABIT_COLUMNS} FROM habits WHERE id = $1 AND user_id = $2`, [
      input.habit_id,
      userId,
    ]);
    if (!habit) throw new HTTPException(404, { message: "Habit not found" });

    const prev = await load(userId, input.date);
    const before = userStreak(prev.habits, prev.checkIns, input.date).current;
    const [checkIn] = await db.query(
      `INSERT INTO check_ins (habit_id, user_id, date, value, status, note) VALUES ($1, $2, $3, $4, $5, COALESCE($6, ''))
       ON CONFLICT (habit_id, date) DO UPDATE SET value = EXCLUDED.value, status = EXCLUDED.status,
         note = COALESCE($6, check_ins.note)
       RETURNING habit_id, to_char(date, 'YYYY-MM-DD') AS date, value, status, note`,
      [input.habit_id, userId, input.date, input.value, input.status, input.note ?? null],
    );
    const { habits, checkIns } = await load(userId, input.date);
    const streak = userStreak(habits, checkIns, input.date).current;
    const me = await profile(userId);
    const message =
      input.status === "slipped"
        ? pickMessage("slip", { lang: me.lang, name: me.name })
        : pickMessage("checkin", { lang: me.lang, name: me.name, category: habit.category_id });
    const milestone = streak > before && MILESTONES.includes(streak) ? streak : null;
    const reached = await evaluate(db, userId, input.date);
    return c.json({
      check_in: checkIn,
      message: milestone ? pickMessage("milestone", { lang: me.lang, name: me.name }) : message,
      streak,
      milestone,
      perfect_day: reached.perfectDay,
      achievements: reached.achievements,
      rewards: reached.rewards,
    });
  });

  authed.delete("/checkins/:habitId/:date", async (c) => {
    const d = c.req.param("date");
    if (!isDateString(d)) throw new HTTPException(400, { message: "date must be YYYY-MM-DD" });
    await db.query(`DELETE FROM check_ins WHERE habit_id = $1 AND date = $2 AND user_id = $3`, [
      c.req.param("habitId"),
      d,
      c.get("userId"),
    ]);
    return c.body(null, 204);
  });

  authed.get("/stats", async (c) => {
    const today = todayParam(c, "today");
    const userId = c.get("userId");
    const { habits, checkIns } = await load(userId, today);
    const faith = faithfulness(habits, checkIns, today);
    const days = daysShowedUp(habits, checkIns);
    const me = await profile(userId);
    const season = higherSeason(me.season, seasonFor(days, faith));
    if (season !== me.season) await db.query(`UPDATE users SET season = $2 WHERE id = $1`, [userId, season]);

    const categories = await db.query<{ id: string; name: string; icon: string }>(
      `SELECT id, name, icon FROM categories WHERE user_id IS NULL OR user_id = $1 ORDER BY sort`,
      [userId],
    );
    const byCategory = categories
      .map((cat) => {
        const hs = habits.filter((h) => h.category_id === cat.id);
        return hs.length ? { ...cat, habits: hs.length, faithfulness: faithfulness(hs, checkIns, today) } : null;
      })
      .filter(Boolean);

    return c.json({
      streak: userStreak(habits, checkIns, today),
      faithfulness: faith,
      days_showed_up: days,
      commitments: habits.length,
      season,
      categories: byCategory,
      history: history(habits, checkIns, today, 35),
    });
  });

  // ---------- weekly recap ----------
  authed.get("/recap", async (c) => {
    const today = todayParam(c, "today");
    const { habits, checkIns } = await load(c.get("userId"), today);
    return c.json({
      this_week: weekSummary(habits, checkIns, today, today),
      last_week: weekSummary(habits, checkIns, addDays(today, -7), today),
      verse: verseOfDay(addDays(today, 3), (await profile(c.get("userId"))).lang),
    });
  });

  // ---------- badges ----------
  authed.get("/achievements", async (c) => {
    const rows = await db.query<{ key: string; unlocked_at: string }>(
      `SELECT key, unlocked_at FROM achievements WHERE user_id = $1`,
      [c.get("userId")],
    );
    const got = new Map(rows.map((r) => [r.key, r.unlocked_at]));
    return c.json({ achievements: ACHIEVEMENTS.map((key) => ({ key, unlocked_at: got.get(key) ?? null })) });
  });

  // ---------- personal reward goals ----------
  authed.get("/rewards", async (c) => {
    const today = todayParam(c, "today");
    const userId = c.get("userId");
    const { habits, checkIns } = await load(userId, today);
    const goals = await db.query<{ id: string; title: string; habit_id: string | null; target_days: number; start_date: string; achieved_at: string | null }>(
      `SELECT id, title, habit_id, target_days, to_char(start_date, 'YYYY-MM-DD') AS start_date, achieved_at
         FROM reward_goals WHERE user_id = $1 ORDER BY achieved_at IS NOT NULL, created_at DESC`,
      [userId],
    );
    return c.json({
      rewards: goals.map((g) => ({
        ...g,
        habit_name: habits.find((h) => h.id === g.habit_id)?.name ?? null,
        progress: Math.min(g.target_days, rewardProgress(g, habits, checkIns)),
      })),
    });
  });

  authed.post("/rewards", async (c) => {
    const g = await body(
      c,
      z.object({
        title: z.string().trim().min(1).max(120),
        target_days: z.number().int().min(1).max(1000),
        habit_id: z.uuid().nullable().default(null),
        start_date: date.optional(),
      }),
    );
    if (g.habit_id) {
      const [own] = await db.query(`SELECT 1 FROM habits WHERE id = $1 AND user_id = $2`, [g.habit_id, c.get("userId")]);
      if (!own) throw new HTTPException(400, { message: "Habit not found" });
    }
    const [reward] = await db.query(
      `INSERT INTO reward_goals (user_id, habit_id, title, target_days, start_date) VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
       RETURNING id, title, habit_id, target_days, to_char(start_date, 'YYYY-MM-DD') AS start_date, achieved_at`,
      [c.get("userId"), g.habit_id, g.title, g.target_days, g.start_date ?? null],
    );
    return c.json({ reward }, 201);
  });

  authed.delete("/rewards/:id", async (c) => {
    const rows = await db.query(`DELETE FROM reward_goals WHERE id = $1 AND user_id = $2 RETURNING id`, [
      c.req.param("id"),
      c.get("userId"),
    ]);
    if (!rows.length) throw new HTTPException(404, { message: "Reward not found" });
    return c.body(null, 204);
  });

  // ---------- reflections ----------
  authed.post("/reflections", async (c) => {
    const r = await body(c, reflectionInput);
    const [reflection] = await db.query(
      `INSERT INTO reflections (user_id, date, type, answers) VALUES ($1, $2, $3, $4)
       RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, type, answers, created_at`,
      [c.get("userId"), r.date, r.type, JSON.stringify(r.answers)],
    );
    return c.json({ reflection }, 201);
  });

  authed.get("/reflections", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 200);
    const reflections = await db.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, type, answers, created_at FROM reflections
        WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2`,
      [c.get("userId"), limit],
    );
    return c.json({ reflections });
  });

  // ---------- content (used by the app to schedule local notifications) ----------
  authed.get("/content", async (c) => {
    const { lang } = await profile(c.get("userId"));
    const { messages, verses, words } = content(lang);
    // Words of encouragement also go into the morning reminders.
    const morningWords = words.map((w) => ({ id: w.id, type: "morning" as const, text: w.text, ref: w.ref }));
    return c.json({ language: lang, messages: [...messages, ...morningWords], verses });
  });

  authed.route("/", createCircle(db));
  authed.route("/", createChallenges(db));

  app.route("/", authed);
  return app;
}
