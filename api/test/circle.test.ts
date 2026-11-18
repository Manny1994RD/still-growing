import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { normalizeCode } from "../src/circle.js";
import { createDb, migrate, type Db } from "../src/db.js";
import { isAllowedMessage } from "../src/moderation.js";

let db: Db;
let app: ReturnType<typeof createApp>;

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function user(name: string) {
  const r = await call(null, "POST", "/auth/register", { email: `${name.toLowerCase()}@example.test`, password: "growing123", name });
  return { token: r.json.token as string, id: r.json.user.id as string };
}

let manny: { token: string; id: string };
let ana: { token: string; id: string };
let david: { token: string; id: string };
let anaCode = "";

beforeAll(async () => {
  db = await createDb("memory://");
  await migrate(db);
  app = createApp(db);
  [manny, ana, david] = [await user("Manny"), await user("Ana"), await user("David")];
});
afterAll(() => db.close());

describe("moderation", () => {
  it("allows kind words and blocks abuse", () => {
    expect(isAllowedMessage("Proud of you, keep going!")).toBe(true);
    expect(isAllowedMessage("Reading Dickens this week")).toBe(true);
    expect(isAllowedMessage("you are a b1tch")).toBe(false);
    expect(isAllowedMessage("f u c k this")).toBe(false);
  });
  it("normalizes friend codes", () => {
    expect(normalizeCode("abcd efgh")).toBe("ABCD-EFGH");
    expect(normalizeCode("ABCD-EFGH")).toBe("ABCD-EFGH");
  });
});

describe("Friends Circle", () => {
  it("is off by default and requires sign-in", async () => {
    expect((await call(null, "GET", "/circle")).status).toBe(401);
    const r = await call(manny.token, "GET", "/circle");
    expect(r.json.settings.circle_enabled).toBe(false);
    expect((await call(manny.token, "POST", "/friends", { code: "AAAA-BBBB" })).status).toBe(403);
  });

  it("turning it on creates a friend code", async () => {
    for (const u of [manny, ana, david]) {
      const r = await call(u.token, "POST", "/circle/settings", { circle_enabled: true });
      expect(r.json.settings.friend_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      if (u === ana) anaCode = r.json.settings.friend_code;
    }
  });

  it("adds a friend by code with mutual acceptance", async () => {
    expect((await call(manny.token, "POST", "/friends", { code: "ZZZZ-ZZZZ" })).status).toBe(404);
    const sent = await call(manny.token, "POST", "/friends", { code: anaCode.toLowerCase().replace("-", " ") });
    expect(sent.status).toBe(201);
    expect(sent.json.status).toBe("pending");
    expect((await call(manny.token, "POST", "/friends", { code: anaCode })).status).toBe(409);

    const anaView = await call(ana.token, "GET", "/circle");
    expect(anaView.json.incoming).toEqual([{ id: manny.id, name: "Manny" }]);
    // Ana can't message Manny before accepting.
    expect((await call(ana.token, "POST", "/encouragements", { to: manny.id, type: "prayer" })).status).toBe(404);
    expect((await call(ana.token, "POST", `/friends/${manny.id}/accept`)).status).toBe(200);
  });

  it("shows growth but never habit names or private areas", async () => {
    const today = "2026-11-18";
    const h = await call(ana.token, "POST", "/habits", { category_id: "faith", name: "Secret prayer list", type: "do", start_date: today });
    await call(ana.token, "POST", "/habits", { category_id: "freedom", name: "No vaping", type: "refrain", start_date: today });
    await call(ana.token, "PUT", "/checkins", { habit_id: h.json.habit.id, date: today });
    await call(ana.token, "PATCH", "/me", { identity_statement: "loves people well" });

    const view = await call(manny.token, "GET", `/circle?today=${today}`);
    const friend = view.json.friends[0];
    expect(friend.name).toBe("Ana");
    expect(friend.days_showed_up).toBe(1);
    expect(friend.commitments).toBe(2);
    expect(friend.areas.map((a: { id: string }) => a.id)).toEqual(["faith"]);
    expect(friend.identity_statement).toBeNull();
    const raw = JSON.stringify(view.json);
    expect(raw).not.toContain("Secret prayer list");
    expect(raw).not.toContain("No vaping");

    await call(ana.token, "POST", "/circle/settings", { share_identity: true });
    expect((await call(manny.token, "GET", `/circle?today=${today}`)).json.friends[0].identity_statement).toBe("loves people well");
  });

  it("sends prayers (once a day) and blessings", async () => {
    const p = await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "prayer" });
    expect(p.status).toBe(201);
    expect((await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "prayer" })).json.status).toBe("already_prayed");
    const b = await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "message", template_id: "b01" });
    expect(b.json.encouragement.text).toBe("Keep going. God is with you.");
    const v = await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "verse", template_id: "Joshua 1:9" });
    expect(v.json.encouragement.ref).toBe("Joshua 1:9");
    const m = await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "message", text: "Proud of you!" });
    expect(m.status).toBe(201);
    expect((await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "message", text: "you b1tch" })).status).toBe(400);

    const summary = await call(ana.token, "GET", "/circle/summary");
    expect(summary.json.unread).toBe(4);
    expect(summary.json.prayed_by).toEqual(["Manny"]);
    await call(ana.token, "POST", "/encouragements/read");
    expect((await call(ana.token, "GET", "/circle/summary")).json.unread).toBe(0);
  });

  it("respects ready-made-only preference", async () => {
    await call(ana.token, "POST", "/circle/settings", { allow_messages: "templates" });
    expect((await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "message", text: "Hi" })).status).toBe(403);
    expect((await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "message", template_id: "b02" })).status).toBe(201);
  });

  it("handles prayer requests between friends only", async () => {
    const r = await call(ana.token, "POST", "/prayer-requests", { text: "Pray for my consistency this week" });
    expect(r.status).toBe(201);
    const id = r.json.request.id;
    expect((await call(ana.token, "POST", `/prayer-requests/${id}/pray`)).status).toBe(400);
    expect((await call(david.token, "POST", `/prayer-requests/${id}/pray`)).status).toBe(404);
    expect((await call(manny.token, "POST", `/prayer-requests/${id}/pray`)).status).toBe(200);
    const view = await call(manny.token, "GET", "/circle");
    expect(view.json.prayer_requests[0]).toMatchObject({ text: "Pray for my consistency this week", praying_count: 1, i_prayed: true, mine: false });
    expect((await call(david.token, "GET", "/circle")).json.prayer_requests).toHaveLength(0);
  });

  it("blocking hides everything and prevents re-adding", async () => {
    expect((await call(ana.token, "POST", `/friends/${manny.id}/block`)).status).toBe(200);
    expect((await call(manny.token, "GET", "/circle")).json.friends).toHaveLength(0);
    expect((await call(ana.token, "GET", "/circle")).json.inbox).toHaveLength(0);
    expect((await call(manny.token, "POST", "/encouragements", { to: ana.id, type: "prayer" })).status).toBe(404);
    expect((await call(manny.token, "POST", "/friends", { code: anaCode })).status).toBe(404);
    // Only the blocker can undo it.
    expect((await call(manny.token, "DELETE", `/friends/${ana.id}`)).status).toBe(404);
    expect((await call(ana.token, "DELETE", `/friends/${manny.id}`)).status).toBe(204);
  });

  it("accepts reports", async () => {
    const r = await call(david.token, "POST", "/reports", { target_type: "user", target_id: manny.id, reason: "spam" });
    expect(r.status).toBe(201);
  });
});
