export type Tone = "gentle" | "scripture" | "coach";
export type HabitType = "do" | "count" | "time" | "weekly" | "refrain";
export type Season = "seed" | "sprout" | "rooted" | "fruitful" | "overflowing";

export interface User {
  id: string;
  email: string;
  name: string;
  tone: Tone;
  vision: string;
  identity_statement: string;
  morning_time: string;
  evening_time: string;
  onboarded: boolean;
  season: Season;
  language: "en" | "es";
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  private_by_default: boolean;
  custom: boolean;
}

export interface Habit {
  id: string;
  category_id: string;
  name: string;
  type: HabitType;
  target: number;
  unit: string;
  days_mask: number;
  reminder_time: string | null;
  share_name: boolean;
  archived: boolean;
  sort: number;
  start_date: string;
  end_date: string | null;
  reminders: string[];
  emoji: string;
  color: string;
  why: string;
  part_of_day: PartOfDay;
  challenge_key: string | null;
}

export type PartOfDay = "any" | "morning" | "afternoon" | "evening";

export interface CheckIn {
  habit_id: string;
  date: string;
  value: number;
  status: "done" | "rest" | "slipped";
  note?: string;
}

export interface Message {
  id: string;
  type: string;
  category?: string;
  text: string;
  ref?: string;
}

export interface Verse {
  ref: string;
  text: string;
}

export interface TodayHabit extends Habit {
  check_in: CheckIn | null;
  week_done: number | null;
  streak: number;
  days_free: number | null;
}

export interface DailyItem {
  kind: "verse" | "word";
  id: string;
  text: string;
  ref: string;
}

export interface TodayResponse {
  date: string;
  verse: Verse;
  words?: DailyItem[];
  greeting: Message;
  habits: TodayHabit[];
}

export interface CheckInResponse {
  check_in: CheckIn;
  message: Message;
  streak: number;
  milestone: number | null;
  perfect_day?: boolean;
  achievements?: string[];
  rewards?: { id: string; title: string }[];
  /** Saved on the device while offline; will sync later. */
  queued?: boolean;
}

export interface Stats {
  streak: { current: number; longest: number; graceUsedThisWeek: boolean };
  faithfulness: number | null;
  days_showed_up: number;
  commitments: number;
  season: Season;
  categories: { id: string; name: string; icon: string; habits: number; faithfulness: number | null }[];
  history: { date: string; due: number; kept: number }[];
}

export type HabitInput = Omit<Habit, "id" | "archived" | "sort" | "start_date" | "end_date" | "challenge_key" | "reminders" | "emoji" | "color" | "why" | "part_of_day"> & {
  start_date?: string;
  reminders?: string[];
  emoji?: string;
  color?: string;
  why?: string;
  part_of_day?: PartOfDay;
};

export interface CircleSettings {
  friend_code: string | null;
  circle_enabled: boolean;
  share_identity: boolean;
  share_struggling: boolean;
  allow_messages: "everyone" | "templates";
}

export interface Friend {
  id: string;
  name: string;
  paused: boolean;
  season?: Season;
  faithfulness?: number | null;
  streak?: number;
  days_showed_up?: number;
  commitments?: number;
  areas?: { id: string; name: string; icon: string }[];
  identity_statement?: string | null;
  needs_encouragement?: boolean;
  accepts_custom?: boolean;
  prayed_today?: boolean;
}

export interface PrayerRequest {
  id: string;
  user_id: string;
  name: string;
  text: string;
  created_at: string;
  mine: boolean;
  praying_count: number;
  i_prayed: boolean;
}

export interface InboxItem {
  id: string;
  from_id: string;
  from_name: string;
  type: "prayer" | "message" | "verse";
  template_id: string | null;
  text: string;
  ref: string | null;
  created_at: string;
  read: boolean;
}

export interface CircleResponse {
  settings: CircleSettings;
  friends: Friend[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
  prayer_requests: PrayerRequest[];
  inbox: InboxItem[];
  unread: number;
  milestones?: { user_id: string; name: string; key: string; unlocked_at: string; celebrated: boolean }[];
}

export interface Blessing {
  id: string;
  text: string;
  ref?: string;
}

export interface WeekSummary {
  start: string;
  end: string;
  days_showed_up: number;
  completions: number;
  perfect_days: number;
  faithfulness: number | null;
  top: { id: string; name: string; emoji: string; count: number }[];
}

export interface Recap {
  this_week: WeekSummary;
  last_week: WeekSummary;
  verse: Verse;
}

export interface Achievement {
  key: string;
  unlocked_at: string | null;
}

export interface RewardGoal {
  id: string;
  title: string;
  habit_id: string | null;
  habit_name: string | null;
  target_days: number;
  start_date: string;
  achieved_at: string | null;
  progress: number;
}

export interface ChallengeInfo {
  key: string;
  emoji: string;
  days: number;
  title: string;
  description: string;
  habits: { name: string; emoji: string; type: HabitType; target: number; unit: string }[];
  joined: { start_date: string; end_date: string; day: number; faithfulness: number | null } | null;
  completed_times: number;
  friends: string[];
}
