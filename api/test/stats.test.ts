import { describe, expect, it } from "vitest";
import {
  daysShowedUp,
  faithfulness,
  habitStreak,
  higherSeason,
  seasonFor,
  userStreak,
  weekStart,
  type CheckInLite,
  type HabitLite,
} from "../src/stats.js";

const daily = (id = "h1", start = "2026-11-01"): HabitLite => ({
  id,
  category_id: "faith",
  type: "do",
  target: 1,
  days_mask: 127,
  start_date: start,
});
const done = (date: string, habit_id = "h1", value = 1): CheckInLite => ({ habit_id, date, value, status: "done" });

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-16"); // Wednesday
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
  });
});

describe("userStreak with grace", () => {
  const h = [daily("h1", "2026-11-09")];

  it("counts consecutive days", () => {
    const c = ["2026-11-16", "2026-11-17", "2026-11-18"].map((d) => done(d));
    expect(userStreak(h, c, "2026-11-18").current).toBe(3);
  });

  it("does not break because today is not done yet", () => {
    const c = ["2026-11-16", "2026-11-17"].map((d) => done(d));
    expect(userStreak(h, c, "2026-11-18").current).toBe(2);
  });

  it("covers one missed day per week with grace", () => {
    // Mon 16 done, Tue 17 missed, Wed 18 done
    const c = ["2026-11-16", "2026-11-18"].map((d) => done(d));
    const s = userStreak(h, c, "2026-11-18");
    expect(s.current).toBe(2);
    expect(s.graceUsedThisWeek).toBe(true);
  });

  it("breaks on a second miss in the same week", () => {
    // Mon 16 done, Tue 17 miss, Wed 18 miss, Thu 19 done
    const c = ["2026-11-16", "2026-11-19"].map((d) => done(d));
    expect(userStreak(h, c, "2026-11-19").current).toBe(1);
  });

  it("gives a fresh grace day each week", () => {
    // week of 9th: miss 11th · week of 16th: miss 17th
    const c = ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-18"].map((d) =>
      done(d),
    );
    expect(userStreak(h, c, "2026-11-18").current).toBe(8);
  });

  it("tracks the longest streak", () => {
    const c = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-17", "2026-11-18"].map((d) => done(d));
    const s = userStreak(h, c, "2026-11-18");
    expect(s.longest).toBe(4);
  });
});

describe("habitStreak", () => {
  it("resets a refrain habit on a slip, without grace", () => {
    const h: HabitLite = { ...daily(), type: "refrain", start_date: "2026-11-15" };
    const c: CheckInLite[] = [done("2026-11-15"), done("2026-11-16"), { habit_id: "h1", date: "2026-11-17", value: 0, status: "slipped" }, done("2026-11-18")];
    expect(habitStreak(h, c, "2026-11-18")).toBe(1);
  });

  it("needs the target for count habits", () => {
    const h: HabitLite = { ...daily(), type: "count", target: 8, start_date: "2026-11-17" };
    expect(habitStreak(h, [done("2026-11-17", "h1", 8), done("2026-11-18", "h1", 5)], "2026-11-18")).toBe(1);
  });

  it("counts weeks for weekly habits", () => {
    const h: HabitLite = { ...daily(), type: "weekly", target: 2, start_date: "2026-11-02" };
    const c = ["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12", "2026-11-17"].map((d) => done(d));
    // weeks of Nov 2 and Nov 9 met; current week in progress
    expect(habitStreak(h, c, "2026-11-18")).toBe(2);
  });

  it("only counts scheduled weekdays", () => {
    // Mon/Wed/Fri = bits 1,3,5
    const h: HabitLite = { ...daily(), days_mask: (1 << 1) | (1 << 3) | (1 << 5), start_date: "2026-11-09" };
    const c = ["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"].map((d) => done(d));
    expect(habitStreak(h, c, "2026-11-18")).toBe(5);
  });
});

describe("faithfulness", () => {
  it("is null with nothing due", () => {
    expect(faithfulness([daily("h1", "2026-11-18")], [], "2026-11-18")).toBeNull();
  });

  it("ignores an unfinished today", () => {
    const h = [daily("h1", "2026-11-15")];
    const c = ["2026-11-15", "2026-11-16"].map((d) => done(d)); // 17 missed, 18 open
    expect(faithfulness(h, c, "2026-11-18")).toBe(67);
  });

  it("counts rest days as kept", () => {
    const h = [daily("h1", "2026-11-16")];
    const c: CheckInLite[] = [done("2026-11-16"), { habit_id: "h1", date: "2026-11-17", value: 0, status: "rest" }];
    expect(faithfulness(h, c, "2026-11-18")).toBe(100);
  });
});

describe("seasons", () => {
  it("unlocks by days and faithfulness", () => {
    expect(seasonFor(0, null)).toBe("seed");
    expect(seasonFor(7, 40)).toBe("sprout");
    expect(seasonFor(21, 70)).toBe("rooted");
    expect(seasonFor(21, 60)).toBe("sprout");
    expect(seasonFor(130, 85)).toBe("overflowing");
  });
  it("never goes backwards", () => {
    expect(higherSeason("rooted", "sprout")).toBe("rooted");
    expect(higherSeason("seed", "sprout")).toBe("sprout");
  });
  it("counts days showed up", () => {
    expect(daysShowedUp([daily()], [done("2026-11-16"), done("2026-11-17")])).toBe(2);
  });
});
