import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createDb, migrate, type Db } from "../src/db.js";
import { addDays } from "../src/stats.js";

let db: Db;
let app: ReturnType<typeof createApp>;
const today = new Date().toISOString().slice(0, 10);
const yesterday = addDays(today, -1);

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function user(name: string, language = "en") {
  const r = await call(null, "POST", "/auth/register", { email: `${name.toLowerCase()}@example.test`, password: "growing123", name, language });
  return { token: r.json.token as string, id: r.json.user.id as string };
}

let joy: { token: string; id: string };
let walkId = "";
let waterId = "";

beforeAll(async () => {
  db = await createDb("memory://");
  await migrate(db);
  app = createApp(db);
  joy = await user("Joy");
});
afterAll(() => db.close());

describe("personal habits", () => {
  it("saves emoji, color, why, part of day and several reminders", async () => {
    const r = await call(joy.token, "POST", "/habits", {
      category_id: "health", name: "Drink water", type: "count", target: 2, unit: "glasses",
      emoji: "💧", color: "#2F6B4F", why: "Energy for my kids", part_of_day: "any",
      reminders: ["15:00", "09:00", "09:00"], start_date: yesterday,
    });
    expect(r.status).toBe(201);
    expect(r.json.habit).toMatchObject({ emoji: "💧", color: "#2F6B4F", why: "Energy for my kids", reminders: ["09:00", "15:00"], reminder_time: "09:00" });
    waterId = r.json.habit.id;
    const walk = await call(joy.token, "POST", "/habits", { category_id: "fitness", name: "Walk", type: "do", part_of_day: "morning", start_date: yesterday });
    walkId = walk.json.habit.id;
    const patched = await call(joy.token, "PATCH", `/habits/${walkId}`, { reminders: ["07:30"] });
    expect(patched.json.habit.reminders).toEqual(["07:30"]);
    expect((await call(joy.token, "POST", "/habits", { category_id: "health", name: "x", type: "do", color: "red" })).status).toBe(400);
  });

  it("reorders habits", async () => {
    await call(joy.token, "POST", "/habits/order", { ids: [walkId, waterId] });
    const list = (await call(joy.token, "GET", "/habits")).json.habits.map((h: { id: string }) => h.id);
    expect(list).toEqual([walkId, waterId]);
  });
});

describe("logging", () => {
  it("logs yesterday with a note, but not far past or future", async () => {
    const r = await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: yesterday, note: "Walked with Mom" });
    expect(r.status).toBe(200);
    expect(r.json.check_in.note).toBe("Walked with Mom");
    // Updating the value keeps the note.
    const again = await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: yesterday, value: 1 });
    expect(again.json.check_in.note).toBe("Walked with Mom");
    expect((await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: addDays(today, -20) })).status).toBe(400);
    expect((await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: addDays(today, 5) })).status).toBe(400);
  });

  it("unlocks badges and reports a perfect day", async () => {
    const first = await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: today });
    expect(first.json.perfect_day).toBe(false);
    const done = await call(joy.token, "PUT", "/checkins", { habit_id: waterId, date: today, value: 2 });
    expect(done.json.perfect_day).toBe(true);
    expect(done.json.achievements).toContain("perfect_day");
    const all = (await call(joy.token, "GET", "/achievements")).json.achievements;
    const got = all.filter((a: { unlocked_at: string | null }) => a.unlocked_at).map((a: { key: string }) => a.key);
    expect(got).toEqual(expect.arrayContaining(["first_step", "perfect_day"]));
    expect(all.length).toBeGreaterThanOrEqual(10);
  });
});

describe("reward goals", () => {
  it("tracks progress and is reached on check-in", async () => {
    const r = await call(joy.token, "POST", "/rewards", { title: "New running shoes", target_days: 3, habit_id: walkId, start_date: yesterday });
    expect(r.status).toBe(201);
    let list = (await call(joy.token, "GET", `/rewards?today=${today}`)).json.rewards;
    expect(list[0]).toMatchObject({ title: "New running shoes", progress: 2, habit_name: "Walk", achieved_at: null });
    // Lower the bar by making a 2-day goal: reached on the next check-in.
    await call(joy.token, "POST", "/rewards", { title: "Coffee treat", target_days: 2, start_date: yesterday });
    const ci = await call(joy.token, "PUT", "/checkins", { habit_id: walkId, date: today });
    expect(ci.json.rewards.map((x: { title: string }) => x.title)).toContain("Coffee treat");
    expect(ci.json.achievements).toContain("reward_reached");
    list = (await call(joy.token, "GET", `/rewards?today=${today}`)).json.rewards;
    expect(list.find((x: { title: string }) => x.title === "Coffee treat").achieved_at).not.toBeNull();
  });
});

describe("weekly recap", () => {
  it("summarizes this week", async () => {
    const r = await call(joy.token, "GET", `/recap?today=${today}`);
    expect(r.json.this_week.completions).toBeGreaterThanOrEqual(2);
    expect(r.json.this_week.top[0].name).toBeTruthy();
    expect(r.json.verse.text).toBeTruthy();
  });
});

describe("guided challenges", () => {
  it("joins in the user's language, shows progress and friends, and can leave", async () => {
    const sol = await user("Sol", "es");
    // Become friends so group challenges show up.
    await call(joy.token, "POST", "/circle/settings", { circle_enabled: true });
    await call(sol.token, "POST", "/circle/settings", { circle_enabled: true });
    const code = (await call(sol.token, "GET", "/circle")).json.settings.friend_code;
    await call(joy.token, "POST", "/friends", { code });
    await call(sol.token, "POST", `/friends/${joy.id}/accept`);

    const list = (await call(sol.token, "GET", "/challenges")).json.challenges;
    expect(list.find((c: { key: string }) => c.key === "prayer21").title).toBe("21 días de oración");

    const joined = await call(sol.token, "POST", "/challenges/prayer21/join", { start_date: today });
    expect(joined.status).toBe(201);
    expect(joined.json.habits.map((h: { name: string }) => h.name)).toContain("Oración de la mañana");
    expect(joined.json.end_date).toBe(addDays(today, 20));
    expect((await call(sol.token, "POST", "/challenges/prayer21/join")).status).toBe(409);

    const mine = (await call(sol.token, "GET", `/challenges?today=${today}`)).json.challenges.find((c: { key: string }) => c.key === "prayer21");
    expect(mine.joined.day).toBe(1);
    const joyView = (await call(joy.token, "GET", `/challenges?today=${today}`)).json.challenges.find((c: { key: string }) => c.key === "prayer21");
    expect(joyView.friends).toEqual(["Sol"]);

    // Challenge habits disappear from Today after they end.
    const later = (await call(sol.token, "GET", `/today?date=${addDays(today, 25)}`)).json.habits;
    expect(later).toHaveLength(0);

    expect((await call(sol.token, "DELETE", "/challenges/prayer21")).status).toBe(204);
    expect((await call(sol.token, "GET", "/habits")).json.habits).toHaveLength(0);
  });

  it("shows friends' new badges in the circle to celebrate", async () => {
    const circle = (await call(
      (await call(null, "POST", "/auth/login", { email: "sol@example.test", password: "growing123" })).json.token,
      "GET",
      "/circle",
    )).json;
    expect(circle.milestones.map((m: { key: string }) => m.key)).toEqual(expect.arrayContaining(["perfect_day"]));
    expect(circle.milestones[0].celebrated).toBe(false);
  });
});

describe("forgot password", () => {
  it("resets with the code from the server log", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await call(null, "POST", "/auth/forgot", { email: "nobody@example.test" })).json.ok).toBe(true);
    await call(null, "POST", "/auth/forgot", { email: "JOY@example.test" });
    const line = log.mock.calls.map((c) => String(c[0])).find((t) => t.includes("joy@example.test"))!;
    log.mockRestore();
    const code = line.match(/(\d{6})/)![1]!;
    expect((await call(null, "POST", "/auth/reset", { email: "joy@example.test", code: "000000", password: "newpass123" })).status).toBe(400);
    const ok = await call(null, "POST", "/auth/reset", { email: "joy@example.test", code, password: "newpass123" });
    expect(ok.status).toBe(200);
    expect(ok.json.token).toBeTruthy();
    expect((await call(null, "POST", "/auth/login", { email: "joy@example.test", password: "newpass123" })).status).toBe(200);
    // Codes are single-use.
    expect((await call(null, "POST", "/auth/reset", { email: "joy@example.test", code, password: "another123" })).status).toBe(400);
  });
});
