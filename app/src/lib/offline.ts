import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api, ApiError } from "./api";
import type { CheckIn, TodayResponse } from "./types";

/**
 * Offline support for the Today screen:
 * - the last Today response per date is cached, so the screen still opens without signal;
 * - check-ins made offline are queued on the device and sent when the connection is back.
 */

const TODAY_KEY = (date: string) => `sg.today.${date}`;
const QUEUE_KEY = "sg.queue";

type Op =
  | { kind: "checkin"; habit_id: string; date: string; value: number; status: CheckIn["status"]; note?: string }
  | { kind: "clear"; habit_id: string; date: string };

const listeners = new Set<(n: number) => void>();
let pending = 0;
const emit = (n: number) => {
  pending = n;
  listeners.forEach((l) => l(n));
};

async function readQueue(): Promise<Op[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]") as Op[];
  } catch {
    return [];
  }
}
async function writeQueue(ops: Op[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {}
  emit(ops.length);
}

export const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0;

export async function cacheToday(data: TodayResponse) {
  try {
    await AsyncStorage.setItem(TODAY_KEY(data.date), JSON.stringify(data));
  } catch {}
}

export async function cachedToday(date: string): Promise<TodayResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(TODAY_KEY(date));
    return raw ? (JSON.parse(raw) as TodayResponse) : null;
  } catch {
    return null;
  }
}

/** Queue an operation; a newer op for the same habit and day replaces the older one. */
export async function enqueue(op: Op) {
  const ops = (await readQueue()).filter((o) => !(o.habit_id === op.habit_id && o.date === op.date));
  ops.push(op);
  await writeQueue(ops);
}

let flushing = false;
/** Send queued check-ins. Stops at the first network error and tries again later. */
export async function flushQueue(): Promise<number> {
  if (flushing) return pending;
  flushing = true;
  try {
    let ops = await readQueue();
    while (ops.length) {
      const op = ops[0]!;
      try {
        if (op.kind === "checkin") await api.checkIn(op.habit_id, op.date, op.value, op.status, op.note);
        else await api.clearCheckIn(op.habit_id, op.date);
      } catch (e) {
        if (isNetworkError(e)) break;
        // The server refused it (e.g. habit deleted): drop it so it doesn't block the rest.
      }
      ops = ops.slice(1);
      await writeQueue(ops);
    }
    return ops.length;
  } finally {
    flushing = false;
  }
}

/** Number of check-ins waiting to sync; retries when the app comes back to the foreground and every 30 s. */
export function usePendingSync(onSynced?: () => void) {
  const [n, setN] = useState(pending);
  useEffect(() => {
    listeners.add(setN);
    void readQueue().then((q) => emit(q.length));
    const tryFlush = async () => {
      const before = pending;
      const left = await flushQueue();
      if (before > 0 && left === 0) onSynced?.();
    };
    void tryFlush();
    const sub = AppState.addEventListener("change", (st) => st === "active" && void tryFlush());
    const timer = setInterval(() => pending > 0 && void tryFlush(), 30_000);
    return () => {
      listeners.delete(setN);
      sub.remove();
      clearInterval(timer);
    };
  }, [onSynced]);
  return n;
}
