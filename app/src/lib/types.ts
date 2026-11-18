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
}

export interface CheckIn {
  habit_id: string;
  date: string;
  value: number;
  status: "done" | "rest" | "slipped";
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

export interface TodayResponse {
  date: string;
  verse: Verse;
  greeting: Message;
  habits: TodayHabit[];
}

export interface CheckInResponse {
  check_in: CheckIn;
  message: Message;
  streak: number;
  milestone: number | null;
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

export type HabitInput = Omit<Habit, "id" | "archived" | "sort" | "start_date"> & { start_date?: string };

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
}

export interface Blessing {
  id: string;
  text: string;
  ref?: string;
}
