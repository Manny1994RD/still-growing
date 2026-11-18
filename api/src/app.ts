import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Db } from "./db.js";
import { createCircle } from "./circle.js";
import { HABIT_COLUMNS, loadProgress } from "./progress.js";
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
  share_name: z.boolean().default(false),
  sort: z.number().int().default(0),
  start_date: date.optional(),
});
const habitPatch = habitInput.partial().extend({ archived: z.boolean().optional() });

const checkInInput = z.object({
  habit_id: z.uuid(),
  date,
  value: z.number().int().min(0).max(100_000).default(1),
  status: z.enum(["done", "rest", "slipped"]).default("done"),
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
    const [habit] = await db.query(
      `INSERT INTO habits (user_id, category_id, name, type, target, unit, days_mask, reminder_time, share_name, sort, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::date, CURRENT_DATE))
       RETURNING ${HABIT_COLUMNS}`,
      [c.get("userId"), h.category_id, h.name, h.type, target, h.unit, h.days_mask, h.reminder_time, h.share_name, h.sort, h.start_date ?? null],
    );
    return c.json({ habit }, 201);
  });

  authed.patch("/habits/:id", async (c) => {
    const patch = await body(c, habitPatch);
    if (patch.category_id) await assertCategory(c.get("userId"), patch.category_id);
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length) {
      const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(", ");
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
      .filter((h) => h.start_date <= today && (h.type === "weekly" || isScheduledDay(h.days_mask, today)))
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
    const [habit] = await db.query<HabitLite>(`SELECT ${HABIT_COLUMNS} FROM habits WHERE id = $1 AND user_id = $2`, [
      input.habit_id,
      userId,
    ]);
    if (!habit) throw new HTTPException(404, { message: "Habit not found" });

    const prev = await load(userId, input.date);
    const before = userStreak(prev.habits, prev.checkIns, input.date).current;
    const [checkIn] = await db.query(
      `INSERT INTO check_ins (habit_id, user_id, date, value, status) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (habit_id, date) DO UPDATE SET value = EXCLUDED.value, status = EXCLUDED.status
       RETURNING habit_id, to_char(date, 'YYYY-MM-DD') AS date, value, status`,
      [input.habit_id, userId, input.date, input.value, input.status],
    );
    const { habits, checkIns } = await load(userId, input.date);
    const streak = userStreak(habits, checkIns, input.date).current;
    const me = await profile(userId);
    const message =
      input.status === "slipped"
        ? pickMessage("slip", { lang: me.lang, name: me.name })
        : pickMessage("checkin", { lang: me.lang, name: me.name, category: habit.category_id });
    const milestone = streak > before && MILESTONES.includes(streak) ? streak : null;
    return c.json({
      check_in: checkIn,
      message: milestone ? pickMessage("milestone", { lang: me.lang, name: me.name }) : message,
      streak,
      milestone,
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

  app.route("/", authed);
  return app;
}
