import type { HabitInput } from "./types";

type Suggestion = Omit<HabitInput, "reminder_time" | "share_name"> & { reminder_time?: string | null };

const s = (category_id: string, name: string, type: Suggestion["type"], target = 1, unit = "", days_mask = 127): Suggestion => ({
  category_id,
  name,
  type,
  target,
  unit,
  days_mask,
});

/** Starter habits shown during onboarding and on the new-habit screen. */
export const SUGGESTIONS: Record<string, Suggestion[]> = {
  faith: [s("faith", "Read the Bible", "time", 15, "min"), s("faith", "Morning prayer", "do"), s("faith", "Memorize a verse", "weekly", 1, "verse")],
  church: [s("church", "Sunday service", "do", 1, "", 0b0000001), s("church", "Small group", "weekly", 1, "time"), s("church", "Serve on a team", "weekly", 1, "time")],
  outreach: [s("outreach", "Share my faith", "weekly", 1, "person"), s("outreach", "Act of kindness", "do"), s("outreach", "Volunteer", "weekly", 1, "time")],
  health: [s("health", "Drink water", "count", 8, "glasses"), s("health", "Vegetables with meals", "count", 3, "meals"), s("health", "No eating after 8 PM", "refrain")],
  fitness: [s("fitness", "Walk", "time", 20, "min"), s("fitness", "Workout", "weekly", 3, "times"), s("fitness", "Stretch", "time", 10, "min")],
  rest: [s("rest", "In bed by 11 PM", "do"), s("rest", "Quiet time", "time", 10, "min"), s("rest", "Sabbath rest", "do", 1, "", 0b0000001)],
  freedom: [s("freedom", "No soda", "refrain"), s("freedom", "No social media before noon", "refrain"), s("freedom", "No smoking", "refrain")],
  mind: [s("mind", "Read", "count", 10, "pages"), s("mind", "Journal", "do"), s("mind", "Gratitude list", "count", 3, "things")],
  relationships: [s("relationships", "Family dinner", "weekly", 3, "times"), s("relationships", "Call my parents", "weekly", 1, "call"), s("relationships", "Pray with my family", "do")],
  stewardship: [s("stewardship", "Tithe", "weekly", 1, "time"), s("stewardship", "No impulse buys", "refrain"), s("stewardship", "Track spending", "do")],
};

export const TYPE_LABELS: Record<HabitInput["type"], { label: string; hint: string }> = {
  do: { label: "Do it", hint: "Done or not done" },
  count: { label: "Count it", hint: "Reach a number, like 8 glasses" },
  time: { label: "Time it", hint: "Reach a number of minutes" },
  weekly: { label: "Weekly", hint: "A number of times each week" },
  refrain: { label: "Stay free", hint: "Avoid something, one day at a time" },
};

export const SEASON_COPY: Record<string, { title: string; line: string }> = {
  seed: { title: "Seed", line: "You've planted something new." },
  sprout: { title: "Sprout", line: "Something is growing." },
  rooted: { title: "Rooted", line: "It's becoming who you are." },
  fruitful: { title: "Fruitful", line: "Others can see the fruit." },
  overflowing: { title: "Overflowing", line: "Your growth encourages others." },
};
