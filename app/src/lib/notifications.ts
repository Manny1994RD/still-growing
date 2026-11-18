import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { localDate } from "./date";
import type { Habit, Message, User } from "./types";

/**
 * Encouragement is scheduled on the device: no push server needed.
 * Each time the app opens (or habits change) we cancel and re-schedule the
 * next 7 days as one-off notifications, so every day gets a different
 * message. iOS allows 64 pending notifications, so we cap at 60.
 */

const supported = Platform.OS === "ios" || Platform.OS === "android";
const MAX_PENDING = 60;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export const notificationsSupported = supported;

export async function requestPermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("encouragement", {
      name: "Encouragement",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function hasPermission(): Promise<boolean> {
  if (!supported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function cancelAllReminders() {
  if (!supported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

const fill = (m: Message, name: string) => m.text.replaceAll("{name}", name || "friend");
const withRef = (m: Message, name: string) => (m.ref ? `${fill(m, name)} (${m.ref})` : fill(m, name));

function at(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h!, m!, 0, 0);
  return d;
}

export async function scheduleWeek(user: User, habits: Habit[], messages: Message[]) {
  if (!supported || !(await hasPermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const morning = messages.filter((m) => m.type === "morning");
  const evening = messages.filter((m) => m.type === "evening");
  const checkin = messages.filter((m) => m.type === "checkin");
  const now = new Date();
  const seed = Number(localDate().replaceAll("-", ""));
  const jobs: { date: Date; title: string; body: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const weekday = day.getDay();

    if (morning.length) {
      const m = morning[(seed + i) % morning.length]!;
      jobs.push({ date: at(day, user.morning_time), title: "Still Growing", body: withRef(m, user.name) });
    }
    for (const h of habits) {
      if (!h.reminder_time || h.archived) continue;
      if (h.type !== "weekly" && !(h.days_mask & (1 << weekday))) continue;
      const pool = checkin.filter((m) => m.category === h.category_id);
      const m = (pool.length ? pool : checkin)[(seed + i + h.name.length) % Math.max(1, (pool.length ? pool : checkin).length)];
      jobs.push({
        date: at(day, h.reminder_time),
        title: h.name,
        body: m ? fill(m, user.name) : "One faithful step today.",
      });
    }
    if (evening.length) {
      const m = evening[(seed + i) % evening.length]!;
      jobs.push({ date: at(day, user.evening_time), title: "Evening check-in", body: fill(m, user.name) });
    }
  }

  const upcoming = jobs
    .filter((j) => j.date.getTime() > now.getTime() + 30_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PENDING);

  for (const j of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: j.title, body: j.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: j.date,
        ...(Platform.OS === "android" ? { channelId: "encouragement" } : {}),
      },
    });
  }
}
