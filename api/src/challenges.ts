import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { asLang, type Lang } from "./content.js";
import type { Db } from "./db.js";
import { HABIT_COLUMNS, loadProgress } from "./progress.js";
import { addDays, faithfulness, isDateString } from "./stats.js";

type Env = { Variables: { userId: string } };

interface ChallengeHabit {
  category_id: string;
  name: Record<Lang, string>;
  type: "do" | "count" | "time" | "weekly" | "refrain";
  target: number;
  unit: Record<Lang, string>;
  emoji: string;
  part_of_day: "any" | "morning" | "afternoon" | "evening";
}

export interface Challenge {
  key: string;
  emoji: string;
  days: number;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  habits: ChallengeHabit[];
}

const u = (en: string, es = en) => ({ en, es });

/** Guided challenges people can join in one tap (alone or with their Circle). */
export const CHALLENGES: Challenge[] = [
  {
    key: "prayer21",
    emoji: "🙏",
    days: 21,
    title: u("21 Days of Prayer", "21 días de oración"),
    description: u(
      "Start and end each day with God, and pray for someone else every day.",
      "Empieza y termina cada día con Dios, y ora por alguien más cada día.",
    ),
    habits: [
      { category_id: "faith", name: u("Morning prayer", "Oración de la mañana"), type: "do", target: 1, unit: u(""), emoji: "🙏", part_of_day: "morning" },
      { category_id: "faith", name: u("Pray for someone", "Orar por alguien"), type: "do", target: 1, unit: u(""), emoji: "💛", part_of_day: "evening" },
    ],
  },
  {
    key: "word40",
    emoji: "📖",
    days: 40,
    title: u("40 Days in the Word", "40 días en la Palabra"),
    description: u(
      "Fifteen minutes in the Bible every day, and one verse to remember each week.",
      "Quince minutos en la Biblia cada día, y un versículo para memorizar cada semana.",
    ),
    habits: [
      { category_id: "faith", name: u("Read the Bible", "Leer la Biblia"), type: "time", target: 15, unit: u("min"), emoji: "📖", part_of_day: "morning" },
      { category_id: "faith", name: u("Memorize a verse", "Memorizar un versículo"), type: "weekly", target: 1, unit: u("verse", "versículo"), emoji: "✍️", part_of_day: "any" },
    ],
  },
  {
    key: "daniel21",
    emoji: "🥗",
    days: 21,
    title: u("Daniel Fast", "Ayuno de Daniel"),
    description: u(
      "Twenty-one days of simple food (fruits, vegetables and water) and reading the book of Daniel.",
      "Veintiún días de comida sencilla (frutas, vegetales y agua) y lectura del libro de Daniel.",
    ),
    habits: [
      { category_id: "health", name: u("Fruits, vegetables and water only", "Solo frutas, vegetales y agua"), type: "refrain", target: 1, unit: u(""), emoji: "🥗", part_of_day: "any" },
      { category_id: "faith", name: u("Read the book of Daniel", "Leer el libro de Daniel"), type: "time", target: 10, unit: u("min"), emoji: "📜", part_of_day: "evening" },
    ],
  },
  {
    key: "gratitude30",
    emoji: "🙌",
    days: 30,
    title: u("30 Days of Gratitude", "30 días de gratitud"),
    description: u(
      "Write down three things you're thankful for, and thank someone in person.",
      "Escribe tres cosas por las que estás agradecido, y dale las gracias a alguien en persona.",
    ),
    habits: [
      { category_id: "mind", name: u("Gratitude list", "Lista de gratitud"), type: "count", target: 3, unit: u("things", "cosas"), emoji: "🙌", part_of_day: "evening" },
      { category_id: "relationships", name: u("Thank someone", "Agradecer a alguien"), type: "do", target: 1, unit: u(""), emoji: "✉️", part_of_day: "any" },
    ],
  },
  {
    key: "temple30",
    emoji: "💪",
    days: 30,
    title: u("30 Days: Honor Your Body", "30 días: honra tu cuerpo"),
    description: u(
      "Your body is a temple. Walk every day and drink enough water.",
      "Tu cuerpo es templo. Camina cada día y toma suficiente agua.",
    ),
    habits: [
      { category_id: "fitness", name: u("Walk", "Caminar"), type: "time", target: 20, unit: u("min"), emoji: "🚶", part_of_day: "afternoon" },
      { category_id: "health", name: u("Drink water", "Tomar agua"), type: "count", target: 8, unit: u("glasses", "vasos"), emoji: "💧", part_of_day: "any" },
    ],
  },
];

export function createChallenges(db: Db) {
  const r = new Hono<Env>();

  async function lang(userId: string): Promise<Lang> {
    const [row] = await db.query<{ language: string }>(`SELECT language FROM users WHERE id = $1`, [userId]);
    return asLang(row?.language);
  }

  r.get("/challenges", async (c) => {
    const userId = c.get("userId");
    const q = c.req.query("today");
    const today = q && isDateString(q) ? q : new Date().toISOString().slice(0, 10);
    const l = await lang(userId);
    const mine = await db.query<{ challenge_key: string; start_date: string; end_date: string }>(
      `SELECT challenge_key, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
         FROM user_challenges WHERE user_id = $1 ORDER BY start_date DESC`,
      [userId],
    );
    // Friends doing the same challenge right now ("group challenge").
    const friends = await db.query<{ challenge_key: string; name: string }>(
      `SELECT uc.challenge_key, u.name FROM user_challenges uc JOIN users u ON u.id = uc.user_id
        WHERE uc.end_date >= $2::date AND u.circle_enabled AND uc.user_id IN (
          SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END FROM friendships
           WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted')`,
      [userId, today],
    );
    const { habits, checkIns } = await loadProgress(db, userId, today);
    const list = CHALLENGES.map((ch) => {
      const current = mine.find((m) => m.challenge_key === ch.key && m.end_date >= today);
      const done = mine.filter((m) => m.challenge_key === ch.key && m.end_date < today).length;
      let progress = null;
      if (current) {
        const day = Math.min(ch.days, Math.round((Date.parse(today) - Date.parse(current.start_date)) / 86_400_000) + 1);
        const hs = habits.filter((h) => h.challenge_key === ch.key && h.start_date >= current.start_date);
        progress = {
          start_date: current.start_date,
          end_date: current.end_date,
          day: Math.max(1, day),
          faithfulness: hs.length ? faithfulness(hs, checkIns, today, Math.max(1, day)) : null,
        };
      }
      return {
        key: ch.key,
        emoji: ch.emoji,
        days: ch.days,
        title: ch.title[l],
        description: ch.description[l],
        habits: ch.habits.map((h) => ({ name: h.name[l], emoji: h.emoji, type: h.type, target: h.target, unit: h.unit[l] })),
        joined: progress,
        completed_times: done,
        friends: [...new Set(friends.filter((f) => f.challenge_key === ch.key).map((f) => f.name))],
      };
    });
    return c.json({ challenges: list });
  });

  r.post("/challenges/:key/join", async (c) => {
    const userId = c.get("userId");
    const ch = CHALLENGES.find((x) => x.key === c.req.param("key"));
    if (!ch) throw new HTTPException(404, { message: "Challenge not found" });
    const body = (await c.req.json().catch(() => ({}))) as { start_date?: string };
    const start = body.start_date && isDateString(body.start_date) ? body.start_date : new Date().toISOString().slice(0, 10);
    const end = addDays(start, ch.days - 1);
    const [active] = await db.query(
      `SELECT 1 FROM user_challenges WHERE user_id = $1 AND challenge_key = $2 AND end_date >= $3::date`,
      [userId, ch.key, start],
    );
    if (active) throw new HTTPException(409, { message: "You're already in this challenge" });
    const l = await lang(userId);
    const created = [];
    for (const [i, h] of ch.habits.entries()) {
      const [habit] = await db.query(
        `INSERT INTO habits (user_id, category_id, name, type, target, unit, days_mask, emoji, part_of_day, challenge_key, start_date, end_date, sort)
         VALUES ($1, $2, $3, $4, $5, $6, 127, $7, $8, $9, $10::date, $11::date, $12)
         RETURNING ${HABIT_COLUMNS}`,
        [userId, h.category_id, h.name[l], h.type, h.target, h.unit[l], h.emoji, h.part_of_day, ch.key, start, end, -100 + i],
      );
      created.push(habit);
    }
    await db.query(
      `INSERT INTO user_challenges (user_id, challenge_key, start_date, end_date) VALUES ($1, $2, $3::date, $4::date)`,
      [userId, ch.key, start, end],
    );
    return c.json({ habits: created, start_date: start, end_date: end }, 201);
  });

  r.delete("/challenges/:key", async (c) => {
    const userId = c.get("userId");
    const key = c.req.param("key");
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.query(
      `DELETE FROM user_challenges WHERE user_id = $1 AND challenge_key = $2 AND end_date >= $3::date RETURNING id`,
      [userId, key, today],
    );
    if (!rows.length) throw new HTTPException(404, { message: "You're not in this challenge" });
    await db.query(`UPDATE habits SET archived = true WHERE user_id = $1 AND challenge_key = $2 AND NOT archived`, [userId, key]);
    return c.body(null, 204);
  });

  return r;
}
