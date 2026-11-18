import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useI18n } from "@/i18n";
import { Button, Row, Txt } from "./components";
import { space } from "./theme";

interface TimerState {
  running: boolean;
  startedAt: number | null; // ms timestamp of the current run
  accumulated: number; // ms from earlier runs
}

const keyFor = (habitId: string, date: string) => `sg.timer.${habitId}.${date}`;
const elapsed = (t: TimerState) => t.accumulated + (t.running && t.startedAt ? Date.now() - t.startedAt : 0);

/**
 * Built-in timer for "time it" habits. It keeps counting if the app is closed
 * (it remembers when it started) and logs the minutes when you finish.
 */
export function HabitTimer({ habitId, date, onFinish }: { habitId: string; date: string; onFinish: (minutes: number) => void }) {
  const { s } = useI18n();
  const [t, setT] = useState<TimerState>({ running: false, startedAt: null, accumulated: 0 });
  const [, tick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(keyFor(habitId, date))
      .then((raw) => raw && setT(JSON.parse(raw) as TimerState))
      .catch(() => {});
  }, [habitId, date]);

  useEffect(() => {
    if (!t.running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t.running]);

  const save = (next: TimerState) => {
    setT(next);
    void AsyncStorage.setItem(keyFor(habitId, date), JSON.stringify(next)).catch(() => {});
  };

  const ms = elapsed(t);
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const minutes = Math.max(1, Math.round(ms / 60000));

  return (
    <View style={{ paddingVertical: space.md }}>
      <Txt v="caption" muted>
        {s.v5.timer}
      </Txt>
      <Txt style={{ fontSize: 48, lineHeight: 56, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </Txt>
      <Row gap={space.sm} style={{ marginTop: space.sm, flexWrap: "wrap" }}>
        {t.running ? (
          <Button title={s.v5.pause} small variant="secondary" icon="pause" onPress={() => save({ running: false, startedAt: null, accumulated: ms })} />
        ) : (
          <Button
            title={ms > 0 ? s.v5.resume : s.v5.startTimer}
            small
            icon="play"
            onPress={() => save({ running: true, startedAt: Date.now(), accumulated: t.accumulated })}
          />
        )}
        {ms >= 30_000 ? (
          <Button
            title={s.v5.finishTimer(minutes)}
            small
            variant="secondary"
            icon="check"
            onPress={() => {
              save({ running: false, startedAt: null, accumulated: 0 });
              void AsyncStorage.removeItem(keyFor(habitId, date)).catch(() => {});
              onFinish(minutes);
            }}
          />
        ) : null}
      </Row>
    </View>
  );
}
