import Constants from "expo-constants";
import { Platform } from "react-native";
import { dict, translateServerError } from "@/i18n";
import { secure } from "./storage";
import type {
  Achievement,
  ChallengeInfo,
  Recap,
  RewardGoal,
  Blessing,
  Category,
  CircleResponse,
  CircleSettings,
  CheckInResponse,
  Habit,
  HabitInput,
  Message,
  Stats,
  TodayResponse,
  User,
  Verse,
} from "./types";

const TOKEN_KEY = "still-growing.token";
const SERVER_KEY = "still-growing.server";

/**
 * Default API address. Set EXPO_PUBLIC_API_URL for real builds. In development
 * it falls back to port 4000 on the machine serving the app, so a phone running
 * Expo Go reaches the API on your computer automatically.
 * Users can override it in the app ("Server" on the sign-in screen), so one
 * build works with any self-hosted server.
 */
function defaultBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}

export const DEFAULT_API_URL = defaultBaseUrl();
let baseUrl = DEFAULT_API_URL;

export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export const server = {
  get url() {
    return baseUrl;
  },
  async load() {
    const saved = await secure.get(SERVER_KEY);
    if (saved) baseUrl = saved;
    return baseUrl;
  },
  /** Checks that the address answers like a Still Growing server, then saves it. */
  async set(input: string) {
    const url = normalizeServerUrl(input);
    let ok = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timer);
      ok = res.ok && (await res.json().catch(() => ({}))).ok === true;
    } catch {}
    if (!ok) throw new ApiError(dict().errors.server(url), 0);
    baseUrl = url;
    if (url === DEFAULT_API_URL) await secure.remove(SERVER_KEY);
    else await secure.set(SERVER_KEY, url);
    return url;
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const session = {
  async load() {
    token = await secure.get(TOKEN_KEY);
    return token;
  },
  async set(t: string) {
    token = t;
    await secure.set(TOKEN_KEY, t);
  },
  async clear() {
    token = null;
    await secure.remove(TOKEN_KEY);
  },
  onUnauthorized(cb: () => void) {
    onUnauthorized = cb;
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(dict().errors.network, 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(translateServerError(data.error ?? `Request failed (${res.status})`), res.status);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string, name: string, language: "en" | "es") =>
    request<{ token: string; user: User }>("POST", "/auth/register", { email, password, name, language }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/login", { email, password }),
  me: () => request<{ user: User }>("GET", "/me"),
  updateMe: (patch: Partial<User>) => request<{ user: User }>("PATCH", "/me", patch),
  deleteMe: () => request<void>("DELETE", "/me"),

  categories: () => request<{ categories: Category[] }>("GET", "/categories"),
  createCategory: (name: string, icon: string) =>
    request<{ category: Category }>("POST", "/categories", { name, icon }),

  habits: () => request<{ habits: Habit[] }>("GET", "/habits"),
  createHabit: (h: HabitInput) => request<{ habit: Habit }>("POST", "/habits", h),
  updateHabit: (id: string, h: Partial<Habit>) => request<{ habit: Habit }>("PATCH", `/habits/${id}`, h),
  deleteHabit: (id: string) => request<void>("DELETE", `/habits/${id}`),

  today: (date: string) => request<TodayResponse>("GET", `/today?date=${date}`),
  checkIn: (habit_id: string, date: string, value: number, status: "done" | "rest" | "slipped" = "done", note?: string) =>
    request<CheckInResponse>("PUT", "/checkins", { habit_id, date, value, status, ...(note !== undefined ? { note } : {}) }),
  clearCheckIn: (habitId: string, date: string) => request<void>("DELETE", `/checkins/${habitId}/${date}`),

  stats: (today: string) => request<Stats>("GET", `/stats?today=${today}`),
  reflect: (date: string, type: "evening" | "ping" | "missed_reason", answers: Record<string, string>) =>
    request("POST", "/reflections", { date, type, answers }),
  content: () => request<{ language: "en" | "es"; messages: Message[]; verses: Verse[] }>("GET", "/content"),

  forgotPassword: (email: string) => request<{ ok: true }>("POST", "/auth/forgot", { email }),
  resetPassword: (email: string, code: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/reset", { email, code, password }),
  reorderHabits: (ids: string[]) => request<void>("POST", "/habits/order", { ids }),
  recap: (today: string) => request<Recap>("GET", `/recap?today=${today}`),
  achievements: () => request<{ achievements: Achievement[] }>("GET", "/achievements"),
  rewards: (today: string) => request<{ rewards: RewardGoal[] }>("GET", `/rewards?today=${today}`),
  createReward: (r: { title: string; target_days: number; habit_id: string | null }) => request("POST", "/rewards", r),
  deleteReward: (id: string) => request<void>("DELETE", `/rewards/${id}`),
  challenges: (today: string) => request<{ challenges: ChallengeInfo[] }>("GET", `/challenges?today=${today}`),
  joinChallenge: (key: string, start_date: string) => request("POST", `/challenges/${key}/join`, { start_date }),
  leaveChallenge: (key: string) => request<void>("DELETE", `/challenges/${key}`),

  // Friends Circle
  circle: (today: string) => request<CircleResponse>("GET", `/circle?today=${today}`),
  circleSummary: () => request<{ unread: number; prayers_today: number; prayed_by: string[] }>("GET", "/circle/summary"),
  circleSettings: (patch: Partial<CircleSettings>) => request<{ settings: CircleSettings }>("POST", "/circle/settings", patch),
  blessings: () => request<{ blessings: Blessing[]; verses: Blessing[] }>("GET", "/circle/blessings"),
  addFriend: (code: string) => request<{ status: "pending" | "accepted"; friend: { id: string; name: string } }>("POST", "/friends", { code }),
  acceptFriend: (id: string) => request("POST", `/friends/${id}/accept`),
  removeFriend: (id: string) => request<void>("DELETE", `/friends/${id}`),
  blockFriend: (id: string) => request("POST", `/friends/${id}/block`),
  encourage: (to: string, type: "prayer" | "message" | "verse", opts: { template_id?: string; text?: string } = {}) =>
    request<{ status: string }>("POST", "/encouragements", { to, type, ...opts }),
  markRead: () => request<void>("POST", "/encouragements/read"),
  createPrayerRequest: (text: string) => request("POST", "/prayer-requests", { text }),
  deletePrayerRequest: (id: string) => request<void>("DELETE", `/prayer-requests/${id}`),
  prayFor: (id: string) => request("POST", `/prayer-requests/${id}/pray`),
  report: (target_type: "user" | "encouragement" | "prayer_request", target_id: string, reason = "") =>
    request("POST", "/reports", { target_type, target_id, reason }),
};
