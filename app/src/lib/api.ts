import Constants from "expo-constants";
import { Platform } from "react-native";
import { secure } from "./storage";
import type {
  Category,
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

/**
 * API base URL. Set EXPO_PUBLIC_API_URL for real builds. In development it
 * falls back to port 4000 on the same machine that serves the app, so a
 * phone running Expo Go reaches the API on your computer automatically.
 */
function resolveBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}

export const API_URL = resolveBaseUrl();

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
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>("POST", "/auth/register", { email, password, name }),
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
  checkIn: (habit_id: string, date: string, value: number, status: "done" | "rest" | "slipped" = "done") =>
    request<CheckInResponse>("PUT", "/checkins", { habit_id, date, value, status }),
  clearCheckIn: (habitId: string, date: string) => request<void>("DELETE", `/checkins/${habitId}/${date}`),

  stats: (today: string) => request<Stats>("GET", `/stats?today=${today}`),
  reflect: (date: string, type: "evening" | "ping" | "missed_reason", answers: Record<string, string>) =>
    request("POST", "/reflections", { date, type, answers }),
  content: () => request<{ messages: Message[]; verses: Verse[] }>("GET", "/content"),
};
