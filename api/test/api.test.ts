import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDb, migrate, type Db } from "../src/db.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let token = "";

async function call(method: string, path: string, body?: unknown, auth = true) {
  const res = await app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  db = await createDb("memory://");
  await migrate(db);
  app = createApp(db);
});
afterAll(() => db.close());

describe("API", () => {
  it("rejects requests without a token", async () => {
    expect((await call("GET", "/me", undefined, false)).status).toBe(401);
  });

  it("registers and logs in", async () => {
    const reg = await call("POST", "/auth/register", { email: "Manny@Example.com", password: "growing123", name: "Manny" }, false);
    expect(reg.status).toBe(201);
    expect(reg.json.user.email).toBe("manny@example.com");
    const dup = await call("POST", "/auth/register", { email: "manny@example.com", password: "growing123" }, false);
    expect(dup.status).toBe(409);
    const bad = await call("POST", "/auth/login", { email: "manny@example.com", password: "wrongpass1" }, false);
    expect(bad.status).toBe(401);
    const ok = await call("POST", "/auth/login", { email: "manny@example.com", password: "growing123" }, false);
    expect(ok.status).toBe(200);
    token = ok.json.token;
  });

  it("updates the profile", async () => {
    const r = await call("PATCH", "/me", { identity_statement: "shows up with faith", onboarded: true, morning_time: "06:30" });
    expect(r.json.user.identity_statement).toBe("shows up with faith");
    expect(r.json.user.morning_time).toBe("06:30");
    expect((await call("PATCH", "/me", { morning_time: "7am" })).status).toBe(400);
  });

  it("lists built-in categories and creates custom ones", async () => {
    const r = await call("GET", "/categories");
    expect(r.json.categories.map((c: { id: string }) => c.id)).toContain("freedom");
    const custom = await call("POST", "/categories", { name: "Music", icon: "music" });
    expect(custom.status).toBe(201);
    expect(custom.json.category.custom).toBe(true);
  });

  let waterId = "";
  let prayId = "";
  it("creates habits of different types", async () => {
    const water = await call("POST", "/habits", {
      category_id: "health", name: "Drink water", type: "count", target: 8, unit: "glasses", start_date: "2026-11-16",
    });
    expect(water.status).toBe(201);
    waterId = water.json.habit.id;
    const pray = await call("POST", "/habits", { category_id: "faith", name: "Morning prayer", type: "do", start_date: "2026-11-16" });
    prayId = pray.json.habit.id;
    expect(pray.json.habit.start_date).toBe("2026-11-16");
    expect((await call("POST", "/habits", { category_id: "nope", name: "x", type: "do" })).status).toBe(400);
  });

  it("checks in and returns encouragement", async () => {
    const r = await call("PUT", "/checkins", { habit_id: prayId, date: "2026-11-16" });
    expect(r.status).toBe(200);
    expect(r.json.message.text.length).toBeGreaterThan(0);
    expect(r.json.streak).toBe(1);
    await call("PUT", "/checkins", { habit_id: prayId, date: "2026-11-17" });
    const third = await call("PUT", "/checkins", { habit_id: prayId, date: "2026-11-18" });
    expect(third.json.streak).toBe(3);
    expect(third.json.milestone).toBe(3);
    // partial water progress, then update
    await call("PUT", "/checkins", { habit_id: waterId, date: "2026-11-18", value: 3 });
    const upd = await call("PUT", "/checkins", { habit_id: waterId, date: "2026-11-18", value: 8 });
    expect(upd.json.check_in.value).toBe(8);
  });

  it("returns today's habits", async () => {
    const r = await call("GET", "/today?date=2026-11-18");
    expect(r.json.habits).toHaveLength(2);
    expect(r.json.verse.ref).toBeTruthy();
    const water = r.json.habits.find((h: { id: string }) => h.id === waterId);
    expect(water.check_in.value).toBe(8);
  });

  it("returns stats", async () => {
    const r = await call("GET", "/stats?today=2026-11-18");
    expect(r.json.streak.current).toBe(3);
    expect(r.json.days_showed_up).toBe(3);
    expect(r.json.commitments).toBe(2);
    expect(r.json.categories.map((c: { id: string }) => c.id).sort()).toEqual(["faith", "health"]);
    expect(r.json.history).toHaveLength(35);
  });

  it("does not let users see each other's data", async () => {
    const other = await call("POST", "/auth/register", { email: "other@example.com", password: "growing123" }, false);
    const mine = token;
    token = other.json.token;
    expect((await call("GET", "/habits")).json.habits).toHaveLength(0);
    expect((await call("PUT", "/checkins", { habit_id: prayId, date: "2026-11-18" })).status).toBe(404);
    expect((await call("DELETE", `/habits/${prayId}`)).status).toBe(404);
    token = mine;
  });

  it("saves reflections", async () => {
    const r = await call("POST", "/reflections", { date: "2026-11-18", type: "evening", answers: { saw_god: "In a kind word" } });
    expect(r.status).toBe(201);
    expect((await call("GET", "/reflections")).json.reflections).toHaveLength(1);
  });

  it("deletes the account", async () => {
    expect((await call("DELETE", "/me")).status).toBe(204);
    expect((await call("GET", "/me")).status).toBe(401);
  });
});
