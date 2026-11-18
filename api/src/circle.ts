import { randomInt } from "node:crypto";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Db } from "./db.js";
import { BLESSINGS, VERSES, asLang, content, localizeTemplate } from "./content.js";
import { isAllowedMessage } from "./moderation.js";
import { loadProgress } from "./progress.js";
import { addDays, daysShowedUp, faithfulness, higherSeason, isDateString, seasonFor, userStreak, type Season } from "./stats.js";

type Env = { Variables: { userId: string } };

const MAX_FRIENDS = 50;
const MAX_SENT_PER_DAY = 30;
const MAX_ACTIVE_REQUESTS = 3;
const QUIET_DAYS_FOR_NUDGE = 3;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

export const ME_COLUMNS = `friend_code, circle_enabled, share_identity, share_struggling, allow_messages`;

function newFriendCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

async function parse<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const json = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Body must be JSON" });
  });
  const r = schema.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HTTPException(400, { message: `${i?.path.join(".") || "body"}: ${i?.message}` });
  }
  return r.data;
}

export function createCircle(db: Db) {
  const circle = new Hono<Env>();

  // ---------- helpers ----------
  async function me(userId: string) {
    const [u] = await db.query<{
      name: string;
      friend_code: string | null;
      circle_enabled: boolean;
      share_identity: boolean;
      share_struggling: boolean;
      allow_messages: "everyone" | "templates";
    }>(`SELECT name, ${ME_COLUMNS} FROM users WHERE id = $1`, [userId]);
    return u!;
  }

  async function requireCircle(userId: string) {
    const u = await me(userId);
    if (!u.circle_enabled) throw new HTTPException(403, { message: "Turn on your Circle first" });
    return u;
  }

  async function relation(a: string, b: string) {
    const [row] = await db.query<{ id: string; requester_id: string; addressee_id: string; status: string; blocked_by: string | null }>(
      `SELECT id, requester_id, addressee_id, status, blocked_by FROM friendships
        WHERE LEAST(requester_id, addressee_id) = LEAST($1::uuid, $2::uuid)
          AND GREATEST(requester_id, addressee_id) = GREATEST($1::uuid, $2::uuid)`,
      [a, b],
    );
    return row ?? null;
  }

  async function requireFriend(userId: string, otherId: string) {
    const r = await relation(userId, otherId);
    if (!r || r.status !== "accepted") throw new HTTPException(404, { message: "Not in your circle" });
    return r;
  }

  const uuid = z.uuid();
  function param(c: Context, name: string) {
    const v = c.req.param(name);
    if (!uuid.safeParse(v).success) throw new HTTPException(404, { message: "Not found" });
    return v as string;
  }

  // ---------- settings ----------
  circle.post("/circle/settings", async (c) => {
    const userId = c.get("userId");
    const patch = await parse(
      c,
      z
        .object({
          circle_enabled: z.boolean(),
          share_identity: z.boolean(),
          share_struggling: z.boolean(),
          allow_messages: z.enum(["everyone", "templates"]),
        })
        .partial(),
    );
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length) {
      const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
      await db.query(`UPDATE users SET ${sets} WHERE id = $1`, [userId, ...entries.map(([, v]) => v)]);
    }
    if (patch.circle_enabled) {
      // Give the user a friend code the first time they turn the Circle on.
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await me(userId);
        if (current.friend_code) break;
        try {
          await db.query(`UPDATE users SET friend_code = $2 WHERE id = $1 AND friend_code IS NULL`, [userId, newFriendCode()]);
        } catch {
          // code collision: try another
        }
      }
    }
    const { name: _n, ...settings } = await me(userId);
    return c.json({ settings });
  });

  async function langOf(userId: string) {
    const [u] = await db.query<{ language: string }>(`SELECT language FROM users WHERE id = $1`, [userId]);
    return asLang(u?.language);
  }

  circle.get("/circle/blessings", async (c) => {
    const { blessings, verses } = content(await langOf(c.get("userId")));
    return c.json({ blessings, verses: verses.map((v) => ({ id: v.id, text: v.text, ref: v.ref })) });
  });

  // ---------- overview ----------
  circle.get("/circle", async (c) => {
    const userId = c.get("userId");
    const todayQ = c.req.query("today");
    const today = todayQ && isDateString(todayQ) ? todayQ : new Date().toISOString().slice(0, 10);
    const { name: _n, ...settings } = await me(userId);
    if (!settings.circle_enabled) return c.json({ settings, friends: [], incoming: [], outgoing: [], prayer_requests: [], inbox: [], unread: 0 });

    const rows = await db.query<{ friend_id: string; status: string; requester_id: string }>(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id, status, requester_id
         FROM friendships WHERE (requester_id = $1 OR addressee_id = $1) AND status IN ('accepted', 'pending')`,
      [userId],
    );
    const ids = rows.map((r) => r.friend_id);
    const people = ids.length
      ? await db.query<{
          id: string;
          name: string;
          season: Season;
          circle_enabled: boolean;
          share_identity: boolean;
          share_struggling: boolean;
          allow_messages: string;
          identity_statement: string;
        }>(
          `SELECT id, name, season, circle_enabled, share_identity, share_struggling, allow_messages, identity_statement
             FROM users WHERE id = ANY($1::uuid[])`,
          [ids],
        )
      : [];
    const byId = new Map(people.map((p) => [p.id, p]));

    const prayedToday = new Set(
      (
        await db.query<{ to_id: string }>(
          `SELECT DISTINCT to_id FROM encouragements WHERE from_id = $1 AND type = 'prayer' AND created_at > now() - interval '20 hours'`,
          [userId],
        )
      ).map((r) => r.to_id),
    );

    const friends = [];
    for (const r of rows.filter((x) => x.status === "accepted")) {
      const p = byId.get(r.friend_id);
      if (!p) continue;
      if (!p.circle_enabled) {
        friends.push({ id: p.id, name: p.name, paused: true });
        continue;
      }
      const { habits, checkIns } = await loadProgress(db, p.id, today);
      const faith = faithfulness(habits, checkIns, today);
      const days = daysShowedUp(habits, checkIns);
      const lastCheckIn = checkIns.reduce<string | null>((m, x) => (x.status !== "slipped" && (!m || x.date > m) ? x.date : m), null);
      const areaRows = habits.length
        ? await db.query<{ id: string; name: string; icon: string }>(
            `SELECT DISTINCT c.id, c.name, c.icon, c.sort FROM categories c
               WHERE c.id = ANY($1::text[]) AND NOT c.private_by_default ORDER BY c.sort`,
            [habits.map((h) => h.category_id)],
          )
        : [];
      const quiet = !lastCheckIn || lastCheckIn < addDays(today, -QUIET_DAYS_FOR_NUDGE + 1);
      friends.push({
        id: p.id,
        name: p.name,
        paused: false,
        season: higherSeason(p.season, seasonFor(days, faith)),
        faithfulness: faith,
        streak: userStreak(habits, checkIns, today).current,
        days_showed_up: days,
        commitments: habits.length,
        areas: areaRows.map((a) => ({ id: a.id, name: a.name, icon: a.icon })),
        // Identity statements were removed from the app; never share them.
        identity_statement: null,
        needs_encouragement: p.share_struggling && habits.length > 0 && quiet,
        accepts_custom: p.allow_messages === "everyone",
        prayed_today: prayedToday.has(p.id),
      });
    }

    const incoming = rows
      .filter((r) => r.status === "pending" && r.requester_id !== userId)
      .map((r) => ({ id: r.friend_id, name: byId.get(r.friend_id)?.name ?? "Someone" }));
    const outgoing = rows
      .filter((r) => r.status === "pending" && r.requester_id === userId)
      .map((r) => ({ id: r.friend_id, name: byId.get(r.friend_id)?.name ?? "Someone" }));

    const friendIds = friends.filter((f) => !f.paused).map((f) => f.id);
    const prayerRequests = await db.query(
      `SELECT pr.id, pr.user_id, u.name, pr.text, pr.created_at, pr.user_id = $1 AS mine,
              (SELECT count(*)::int FROM prayer_responses r WHERE r.request_id = pr.id) AS praying_count,
              EXISTS (SELECT 1 FROM prayer_responses r WHERE r.request_id = pr.id AND r.user_id = $1) AS i_prayed
         FROM prayer_requests pr JOIN users u ON u.id = pr.user_id
        WHERE pr.expires_at > now() AND (pr.user_id = $1 OR pr.user_id = ANY($2::uuid[]))
        ORDER BY pr.created_at DESC LIMIT 30`,
      [userId, friendIds],
    );

    const inbox = await db.query(
      `SELECT e.id, e.from_id, u.name AS from_name, e.type, e.template_id, e.text, e.ref, e.created_at, e.read_at IS NOT NULL AS read
         FROM encouragements e JOIN users u ON u.id = e.from_id
        WHERE e.to_id = $1
          AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked'
                AND LEAST(f.requester_id, f.addressee_id) = LEAST(e.from_id, e.to_id)
                AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(e.from_id, e.to_id))
        ORDER BY e.created_at DESC LIMIT 50`,
      [userId],
    );
    const lang = await langOf(userId);
    for (const m of inbox as { type: string; template_id: string | null; text: string; ref: string | null }[]) {
      const local = localizeTemplate(m.type, m.template_id, lang);
      if (local) Object.assign(m, local);
    }
    const unread = inbox.filter((m) => !(m as { read: boolean }).read).length;

    // Friends' badges from the last 7 days, so the circle can celebrate together.
    const milestones = friendIds.length
      ? await db.query<{ user_id: string; name: string; key: string; unlocked_at: string; celebrated: boolean }>(
          `SELECT a.user_id, u.name, a.key, a.unlocked_at,
                  EXISTS (SELECT 1 FROM encouragements e WHERE e.from_id = $1 AND e.to_id = a.user_id
                          AND e.template_id = 'b11' AND e.created_at >= a.unlocked_at) AS celebrated
             FROM achievements a JOIN users u ON u.id = a.user_id
            WHERE a.user_id = ANY($2::uuid[]) AND a.unlocked_at > now() - interval '7 days'
            ORDER BY a.unlocked_at DESC LIMIT 20`,
          [userId, friendIds],
        )
      : [];

    return c.json({ settings, friends, incoming, outgoing, prayer_requests: prayerRequests, inbox, unread, milestones });
  });

  /** Small summary for the Today screen. */
  circle.get("/circle/summary", async (c) => {
    const userId = c.get("userId");
    const [row] = await db.query<{ unread: number; prayers: number; names: string[] | null }>(
      `SELECT count(*) FILTER (WHERE e.read_at IS NULL)::int AS unread,
              count(*) FILTER (WHERE e.type = 'prayer' AND e.created_at > now() - interval '24 hours')::int AS prayers,
              (array_agg(DISTINCT u.name) FILTER (WHERE e.type = 'prayer' AND e.created_at > now() - interval '24 hours'))[1:3] AS names
         FROM encouragements e JOIN users u ON u.id = e.from_id
        WHERE e.to_id = $1
          AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked'
                AND LEAST(f.requester_id, f.addressee_id) = LEAST(e.from_id, e.to_id)
                AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(e.from_id, e.to_id))`,
      [userId],
    );
    return c.json({ unread: row?.unread ?? 0, prayers_today: row?.prayers ?? 0, prayed_by: row?.names ?? [] });
  });

  // ---------- friends ----------
  circle.post("/friends", async (c) => {
    const userId = c.get("userId");
    await requireCircle(userId);
    const { code } = await parse(c, z.object({ code: z.string().min(4).max(20) }));
    const [target] = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM users WHERE friend_code = $1 AND circle_enabled`,
      [normalizeCode(code)],
    );
    const notFound = new HTTPException(404, { message: "No one found with that code" });
    if (!target) throw notFound;
    if (target.id === userId) throw new HTTPException(400, { message: "That's your own code" });

    const existing = await relation(userId, target.id);
    if (existing?.status === "blocked") throw notFound;
    if (existing?.status === "accepted") throw new HTTPException(409, { message: `${target.name} is already in your circle` });
    if (existing?.status === "pending") {
      if (existing.requester_id === userId) throw new HTTPException(409, { message: "Request already sent" });
      await db.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, [existing.id]);
      return c.json({ status: "accepted", friend: target });
    }
    const [{ n }] = (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM friendships WHERE (requester_id = $1 OR addressee_id = $1) AND status <> 'blocked'`,
      [userId],
    )) as [{ n: number }];
    if (n >= MAX_FRIENDS) throw new HTTPException(409, { message: `Circles are limited to ${MAX_FRIENDS} people` });
    await db.query(`INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)`, [userId, target.id]);
    return c.json({ status: "pending", friend: target }, 201);
  });

  circle.post("/friends/:userId/accept", async (c) => {
    const userId = c.get("userId");
    const other = param(c, "userId");
    const rows = await db.query(
      `UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING id`,
      [other, userId],
    );
    if (!rows.length) throw new HTTPException(404, { message: "Request not found" });
    return c.json({ status: "accepted" });
  });

  /** Decline, cancel, remove, or unblock (only the blocker can unblock). */
  circle.delete("/friends/:userId", async (c) => {
    const userId = c.get("userId");
    const other = param(c, "userId");
    const r = await relation(userId, other);
    if (!r || (r.status === "blocked" && r.blocked_by !== userId)) throw new HTTPException(404, { message: "Not found" });
    await db.query(`DELETE FROM friendships WHERE id = $1`, [r.id]);
    return c.body(null, 204);
  });

  circle.post("/friends/:userId/block", async (c) => {
    const userId = c.get("userId");
    const other = param(c, "userId");
    const [exists] = await db.query(`SELECT 1 FROM users WHERE id = $1`, [other]);
    if (!exists || other === userId) throw new HTTPException(404, { message: "Not found" });
    const r = await relation(userId, other);
    if (r) await db.query(`UPDATE friendships SET status = 'blocked', blocked_by = $2 WHERE id = $1`, [r.id, userId]);
    else await db.query(`INSERT INTO friendships (requester_id, addressee_id, status, blocked_by) VALUES ($1, $2, 'blocked', $1)`, [userId, other]);
    return c.json({ status: "blocked" });
  });

  // ---------- encouragement ----------
  circle.post("/encouragements", async (c) => {
    const userId = c.get("userId");
    await requireCircle(userId);
    const input = await parse(
      c,
      z.object({
        to: z.uuid(),
        type: z.enum(["prayer", "message", "verse"]),
        template_id: z.string().max(64).optional(),
        text: z.string().trim().max(200).optional(),
      }),
    );
    await requireFriend(userId, input.to);
    const [recipient] = await db.query<{ circle_enabled: boolean; allow_messages: string }>(
      `SELECT circle_enabled, allow_messages FROM users WHERE id = $1`,
      [input.to],
    );
    if (!recipient?.circle_enabled) throw new HTTPException(409, { message: "Their circle is paused right now" });

    const [{ n }] = (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM encouragements WHERE from_id = $1 AND created_at > now() - interval '24 hours'`,
      [userId],
    )) as [{ n: number }];
    if (n >= MAX_SENT_PER_DAY) throw new HTTPException(429, { message: "You've sent a lot today. Try again tomorrow." });

    let text = "";
    let ref: string | null = null;
    let templateId: string | null = null;
    if (input.type === "prayer") {
      const [already] = await db.query(
        `SELECT id FROM encouragements WHERE from_id = $1 AND to_id = $2 AND type = 'prayer' AND created_at > now() - interval '20 hours'`,
        [userId, input.to],
      );
      if (already) return c.json({ status: "already_prayed" });
    } else if (input.type === "verse") {
      const v = VERSES.find((x) => x.id === input.template_id);
      if (!v) throw new HTTPException(400, { message: "Unknown verse" });
      text = v.text;
      ref = v.ref;
      templateId = v.id;
    } else if (input.template_id) {
      const b = BLESSINGS.find((x) => x.id === input.template_id);
      if (!b) throw new HTTPException(400, { message: "Unknown blessing" });
      text = b.text;
      ref = b.ref ?? null;
      templateId = b.id;
    } else {
      if (!input.text) throw new HTTPException(400, { message: "Write a message or pick a blessing" });
      if (recipient.allow_messages !== "everyone") {
        throw new HTTPException(403, { message: "They receive ready-made blessings only" });
      }
      if (!isAllowedMessage(input.text)) throw new HTTPException(400, { message: "Please keep messages kind and encouraging" });
      text = input.text;
    }

    const [encouragement] = await db.query(
      `INSERT INTO encouragements (from_id, to_id, type, template_id, text, ref) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, text, ref, created_at`,
      [userId, input.to, input.type, templateId, text, ref],
    );
    return c.json({ status: "sent", encouragement }, 201);
  });

  circle.post("/encouragements/read", async (c) => {
    await db.query(`UPDATE encouragements SET read_at = now() WHERE to_id = $1 AND read_at IS NULL`, [c.get("userId")]);
    return c.body(null, 204);
  });

  // ---------- prayer requests ----------
  circle.post("/prayer-requests", async (c) => {
    const userId = c.get("userId");
    await requireCircle(userId);
    const { text } = await parse(c, z.object({ text: z.string().trim().min(1).max(280) }));
    if (!isAllowedMessage(text)) throw new HTTPException(400, { message: "Please keep requests kind" });
    const [{ n }] = (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM prayer_requests WHERE user_id = $1 AND expires_at > now()`,
      [userId],
    )) as [{ n: number }];
    if (n >= MAX_ACTIVE_REQUESTS) throw new HTTPException(409, { message: `You can have ${MAX_ACTIVE_REQUESTS} open requests at a time` });
    const [request] = await db.query(
      `INSERT INTO prayer_requests (user_id, text) VALUES ($1, $2) RETURNING id, text, created_at, expires_at`,
      [userId, text],
    );
    return c.json({ request }, 201);
  });

  circle.delete("/prayer-requests/:id", async (c) => {
    const rows = await db.query(`DELETE FROM prayer_requests WHERE id = $1 AND user_id = $2 RETURNING id`, [
      param(c, "id"),
      c.get("userId"),
    ]);
    if (!rows.length) throw new HTTPException(404, { message: "Request not found" });
    return c.body(null, 204);
  });

  circle.post("/prayer-requests/:id/pray", async (c) => {
    const userId = c.get("userId");
    await requireCircle(userId);
    const [req] = await db.query<{ user_id: string }>(
      `SELECT user_id FROM prayer_requests WHERE id = $1 AND expires_at > now()`,
      [param(c, "id")],
    );
    if (!req) throw new HTTPException(404, { message: "Request not found" });
    if (req.user_id === userId) throw new HTTPException(400, { message: "This is your own request" });
    await requireFriend(userId, req.user_id);
    const inserted = await db.query(
      `INSERT INTO prayer_responses (request_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING request_id`,
      [c.req.param("id"), userId],
    );
    if (inserted.length) {
      await db.query(
        `INSERT INTO encouragements (from_id, to_id, type, template_id) VALUES ($1, $2, 'prayer', 'request')`,
        [userId, req.user_id],
      );
    }
    return c.json({ status: "praying" });
  });

  // ---------- reports ----------
  circle.post("/reports", async (c) => {
    const input = await parse(
      c,
      z.object({
        target_type: z.enum(["user", "encouragement", "prayer_request"]),
        target_id: z.uuid(),
        reason: z.string().trim().max(500).default(""),
      }),
    );
    await db.query(`INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)`, [
      c.get("userId"),
      input.target_type,
      input.target_id,
      input.reason,
    ]);
    return c.json({ status: "received" }, 201);
  });

  return circle;
}
