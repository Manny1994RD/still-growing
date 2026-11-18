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
