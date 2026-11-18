import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { dict } from "@/i18n";
import { api } from "./api";
import { localDate } from "./date";
import { enqueue, isNetworkError } from "./offline";
import type { Habit, Message, User } from "./types";

/**
 * Encouragement is scheduled on the device: no push server needed.
 * Each time the app opens (or habits change) we cancel and re-schedule the
 * next 7 days as one-off notifications, so every day gets a different
 * message. iOS allows 64 pending notifications, so we cap at 60.
 *
 * Yes/no habits get a "Done ✓" button on the reminder itself.
 */

const supported = Platform.OS === "ios" || Platform.OS === "android";
const MAX_PENDING = 60;
const CATEGORY = "habit-done";
const ACTION_DONE = "done";

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

async function setupCategory() {
  if (!supported) return;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: ACTION_DONE, buttonTitle: dict().v5.doneAction, options: { opensAppToForeground: false } },
    ]);
  } catch {}
}

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

/** Handles the "Done ✓" button on a reminder: logs the habit for today (or queues it offline). */
export function listenForDoneActions() {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (response.actionIdentifier !== ACTION_DONE) return;
    const habitId = response.notification.request.content.data?.habitId;
    if (typeof habitId !== "string") return;
    const date = localDate();
    try {
      await api.checkIn(habitId, date, 1, "done");
    } catch (e) {
      if (isNetworkError(e)) await enqueue({ kind: "checkin", habit_id: habitId, date, value: 1, status: "done" });
    }
    try {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);
    } catch {}
  });
  return () => sub.remove();
}

const fill = (m: Message, name: string) => m.text.replaceAll("{name}", name || dict().common.friend);
const withRef = (m: Message, name: string) => (m.ref ? `${fill(m, name)} (${m.ref})` : fill(m, name));

function at(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h!, m!, 0, 0);
  return d;
}

export async function scheduleWeek(user: User, habits: Habit[], messages: Message[]) {
  if (!supported || !(await hasPermission())) return;
  await setupCategory();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const morning = messages.filter((m) => m.type === "morning");
  const evening = messages.filter((m) => m.type === "evening");
  const checkin = messages.filter((m) => m.type === "checkin");
  const now = new Date();
  const seed = Number(localDate().replaceAll("-", ""));
  const jobs: { date: Date; title: string; body: string; habitId?: string; actionable?: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const weekday = day.getDay();
    const dayStr = localDate(day);

    if (morning.length) {
      const m = morning[(seed + i) % morning.length]!;
      jobs.push({ date: at(day, user.morning_time), title: dict().notifications.appTitle, body: withRef(m, user.name) });
    }
    for (const h of habits) {
      if (h.archived) continue;
      if (dayStr < h.start_date || (h.end_date && dayStr > h.end_date)) continue;
      if (h.type !== "weekly" && !(h.days_mask & (1 << weekday))) continue;
      const times = h.reminders?.length ? h.reminders : h.reminder_time ? [h.reminder_time] : [];
      const pool = checkin.filter((m) => m.category === h.category_id);
      const list = pool.length ? pool : checkin;
      times.forEach((time, k) => {
        const m = list[(seed + i + k + h.name.length) % Math.max(1, list.length)];
        // "Your why" leads the reminder when the person has written one.
        const body = h.why ? `${h.why}` : m ? fill(m, user.name) : dict().notifications.fallback;
        jobs.push({
          date: at(day, time),
          title: `${h.emoji ? `${h.emoji} ` : ""}${h.name}`,
          body,
          habitId: h.id,
          actionable: h.type === "do" || h.type === "weekly" || h.type === "refrain",
        });
      });
    }
    if (evening.length) {
      const m = evening[(seed + i) % evening.length]!;
      jobs.push({ date: at(day, user.evening_time), title: dict().notifications.eveningTitle, body: fill(m, user.name) });
    }
  }

  const upcoming = jobs
    .filter((j) => j.date.getTime() > now.getTime() + 30_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PENDING);

  for (const j of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: j.title,
        body: j.body,
        data: j.habitId ? { habitId: j.habitId } : {},
        ...(j.actionable ? { categoryIdentifier: CATEGORY } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: j.date,
        ...(Platform.OS === "android" ? { channelId: "encouragement" } : {}),
      },
    });
  }
}
