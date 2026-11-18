import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { greetingFor, localDate, prettyDate } from "@/lib/date";
import type { Category, CheckIn, TodayHabit, TodayResponse } from "@/lib/types";
import {
  Button,
  Card,
  Check,
  ErrorText,
  Field,
  Header,
  Icon,
  IconButton,
  ProgressBar,
  SectionLabel,
  Sheet,
  SheetAction,
  Spacer,
  Txt,
  Verse,
} from "@/ui/components";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const goalOf = (h: TodayHabit) => (h.type === "count" || h.type === "time" ? h.target : 1);

function stateOf(h: TodayHabit): "empty" | "partial" | "done" | "slipped" | "rest" {
  const ci = h.check_in;
  if (!ci) return "empty";
  if (ci.status === "rest") return "rest";
  if (ci.status === "slipped") return "slipped";
  return ci.value >= goalOf(h) ? "done" : ci.value > 0 ? "partial" : "empty";
}

function subtitle(h: TodayHabit, cat?: Category): string {
  const parts: string[] = [];
  const v = h.check_in?.value ?? 0;
  if (h.type === "count" || h.type === "time") parts.push(`${Math.min(v, 9999)} of ${h.target} ${h.unit || (h.type === "time" ? "min" : "")}`.trim());
  if (h.type === "weekly") parts.push(`${h.week_done ?? 0} of ${h.target} this week`);
  if (h.type === "refrain") parts.push(h.check_in?.status === "slipped" ? "New start tomorrow" : `${h.days_free ?? 0} days free`);
  if (h.streak > 1 && h.type !== "refrain") parts.push(`${h.streak} ${h.type === "weekly" ? "week" : "day"} streak`);
  if (cat) parts.unshift(cat.name);
  return parts.join(" · ");
}

export default function Today() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [cats, setCats] = useState<Record<string, Category>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<TodayHabit | null>(null);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [circle, setCircle] = useState<{ unread: number; prayers_today: number; prayed_by: string[] } | null>(null);
  const today = localDate();

  const load = useCallback(async () => {
    try {
      const [t, cs] = await Promise.all([api.today(localDate()), api.categories()]);
      setData(t);
      setCats(Object.fromEntries(cs.categories.map((x) => [x.id, x])));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    api.circleSummary().then(setCircle, () => setCircle(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const patchLocal = (id: string, ci: CheckIn | null, weekDelta = 0) =>
    setData((d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.id === id ? { ...h, check_in: ci, week_done: h.week_done === null ? null : Math.max(0, h.week_done + weekDelta) } : h,
        ),
      },
    );

  async function set(h: TodayHabit, value: number, status: CheckIn["status"] = "done") {
    const before = h.check_in;
    const wasCounted = before && before.status !== "slipped" && before.value > 0 ? 1 : 0;
    const nowCounted = status !== "slipped" && value > 0 ? 1 : 0;
    patchLocal(h.id, { habit_id: h.id, date: today, value, status }, nowCounted - wasCounted);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const r = await api.checkIn(h.id, today, value, status);
      const reachedGoal = status === "done" && value >= goalOf(h) && (before?.value ?? 0) < goalOf(h);
      if (r.milestone) {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast({ title: `${r.milestone} days`, text: r.message.text, ref: r.message.ref });
      } else if (reachedGoal || status === "slipped" || status === "rest") {
        toast({ text: status === "rest" ? "Even God rested. Enjoy today." : r.message.text, ref: status === "rest" ? "Genesis 2:2" : r.message.ref });
      }
      void load();
    } catch (e) {
      patchLocal(h.id, before);
      setError((e as Error).message);
    }
  }

  async function clear(h: TodayHabit) {
    const before = h.check_in;
    patchLocal(h.id, null, before && before.status !== "slipped" && before.value > 0 ? -1 : 0);
    try {
      await api.clearCheckIn(h.id, today);
      void load();
    } catch (e) {
      patchLocal(h.id, before);
      setError((e as Error).message);
    }
  }

  function primary(h: TodayHabit) {
    const s = stateOf(h);
    const v = h.check_in?.status === "done" ? h.check_in.value : 0;
    if (h.type === "count") return s === "done" ? setSheet(h) : set(h, v + 1);
    if (h.type === "time") return s === "done" ? setSheet(h) : set(h, Math.min(v + 5, h.target));
    return s === "empty" ? set(h, 1) : clear(h);
  }

  const habits = data?.habits ?? [];
  const doneCount = habits.filter((h) => ["done", "rest"].includes(stateOf(h))).length;
  const showEvening = new Date().getHours() >= Number((user?.evening_time ?? "20:00").slice(0, 2));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: space.xl }}>
          <Header
            eyebrow={prettyDate(today)}
            title={`${greetingFor()},\n${user?.name || "friend"}.`}
            right={<IconButton name="plus" label="New habit" onPress={() => router.push("/habit/new")} />}
          />

          {user?.identity_statement ? (
            <Txt muted style={{ marginTop: -space.md, marginBottom: space.xl }}>
              Becoming someone who {user.identity_statement.replace(/^…|^\.{3}/, "")}
            </Txt>
          ) : null}

          {data ? (
            <Card>
              <Verse text={data.verse.text} refText={data.verse.ref} />
            </Card>
          ) : null}

          {circle && (circle.prayers_today > 0 || circle.unread > 0) ? (
            <Pressable onPress={() => router.push("/circle")} style={{ marginTop: space.md }}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg }}>
                <Icon name="heart" />
                <Txt style={{ flex: 1 }}>
                  {circle.prayers_today > 0
                    ? `${circle.prayed_by.slice(0, 2).join(" and ")}${circle.prayers_today > 2 ? " and others" : ""} prayed for you today`
                    : `${circle.unread} new ${circle.unread === 1 ? "encouragement" : "encouragements"}`}
                </Txt>
                <Icon name="chevron-right" color={c.muted} />
              </Card>
            </Pressable>
          ) : null}

          <ErrorText>{error}</ErrorText>

          <SectionLabel right={habits.length ? <Txt v="caption" muted>{`${doneCount}/${habits.length}`}</Txt> : undefined}>
            Today's steps
          </SectionLabel>
          {habits.length ? <ProgressBar value={doneCount / habits.length} height={3} /> : null}
          <Spacer h={space.sm} />

          {data && habits.length === 0 ? (
            <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.lg }}>
              <Txt muted center>
                Nothing scheduled today. Rest, or take a new step.
              </Txt>
              <Button title="Add a habit" icon="plus" small variant="secondary" onPress={() => router.push("/habit/new")} />
            </View>
          ) : null}

          {habits.map((h) => {
            const s = stateOf(h);
            const cat = cats[h.category_id];
            const showBar = (h.type === "count" || h.type === "time") && s !== "done" && s !== "rest";
            return (
              <Pressable
                key={h.id}
                onPress={() => primary(h)}
                onLongPress={() => setSheet(h)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${h.name}, ${s === "done" ? "done" : "not done"}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.lg,
                  paddingVertical: space.lg,
                  borderBottomWidth: 1,
                  borderBottomColor: c.hairline,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Check state={s} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="heading" style={s === "done" || s === "rest" ? { color: c.muted } : undefined}>
                    {h.name}
                  </Txt>
                  <Txt v="small" muted numberOfLines={1}>
                    {subtitle(h, cat)}
                  </Txt>
                  {showBar ? (
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar value={(h.check_in?.value ?? 0) / goalOf(h)} height={3} />
                    </View>
                  ) : null}
                </View>
                <Pressable hitSlop={12} onPress={() => setSheet(h)} accessibilityLabel={`More options for ${h.name}`}>
                  <Icon name="more-horizontal" color={c.muted} />
                </Pressable>
              </Pressable>
            );
          })}

          {habits.length ? (
            <Txt v="small" muted style={{ marginTop: space.md }}>
              Tap to check in · hold for more
            </Txt>
          ) : null}

          {showEvening && habits.length ? (
            <>
              <SectionLabel>Evening</SectionLabel>
              <Pressable onPress={() => setReflectOpen(true)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
                  <Icon name="moon" />
                  <View style={{ flex: 1 }}>
                    <Txt v="heading">Evening check-in</Txt>
                    <Txt v="small" muted>
                      A quiet minute with God
                    </Txt>
                  </View>
                  <Icon name="chevron-right" color={c.muted} />
                </Card>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      <HabitSheet
        habit={sheet}
        onClose={() => setSheet(null)}
        onSet={(h, v, st) => {
          setSheet(null);
          void set(h, v, st);
        }}
        onClear={(h) => {
          setSheet(null);
          void clear(h);
        }}
        onEdit={(h) => {
          setSheet(null);
          router.push(`/habit/${h.id}`);
        }}
      />
      <ReflectSheet visible={reflectOpen} onClose={() => setReflectOpen(false)} date={today} onSaved={() => toast({ text: "Lay today down. He cares for you.", ref: "1 Peter 5:7" })} />
    </SafeAreaView>
  );
}

function HabitSheet({
  habit: h,
  onClose,
  onSet,
  onClear,
  onEdit,
}: {
  habit: TodayHabit | null;
  onClose: () => void;
  onSet: (h: TodayHabit, value: number, status?: CheckIn["status"]) => void;
  onClear: (h: TodayHabit) => void;
  onEdit: (h: TodayHabit) => void;
}) {
  if (!h) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const v = h.check_in?.status === "done" ? h.check_in.value : 0;
  return (
    <Sheet visible onClose={onClose} title={h.name}>
      {h.type === "count" ? (
        <>
          <SheetAction icon="plus" label={`Add 1 ${h.unit}`.trim()} onPress={() => onSet(h, v + 1)} />
          {v > 0 ? <SheetAction icon="minus" label={`Remove 1 ${h.unit}`.trim()} onPress={() => onSet(h, v - 1)} /> : null}
          <SheetAction icon="check-circle" label={`Complete goal (${h.target})`} onPress={() => onSet(h, Math.max(v, h.target))} />
        </>
      ) : null}
      {h.type === "time" ? (
        <>
          <SheetAction icon="plus" label="Add 5 minutes" onPress={() => onSet(h, v + 5)} />
          <SheetAction icon="plus" label="Add 15 minutes" onPress={() => onSet(h, v + 15)} />
          <SheetAction icon="check-circle" label={`Complete goal (${h.target} min)`} onPress={() => onSet(h, Math.max(v, h.target))} />
        </>
      ) : null}
      {h.type === "do" || h.type === "weekly" ? <SheetAction icon="check-circle" label="Mark done" onPress={() => onSet(h, 1)} /> : null}
      {h.type === "refrain" ? (
        <>
          <SheetAction icon="shield" label="I stayed free today" onPress={() => onSet(h, 1)} />
          <SheetAction icon="rotate-ccw" label="I slipped. Start fresh" onPress={() => onSet(h, 0, "slipped")} />
        </>
      ) : (
        <SheetAction icon="moon" label="Rest day (keeps your streak)" onPress={() => onSet(h, 0, "rest")} />
      )}
      {h.check_in ? <SheetAction icon="x" label="Clear today" onPress={() => onClear(h)} /> : null}
      <SheetAction icon="edit-2" label="Edit habit" onPress={() => onEdit(h)} />
    </Sheet>
  );
}

function ReflectSheet({ visible, onClose, date, onSaved }: { visible: boolean; onClose: () => void; date: string; onSaved: () => void }) {
  const [sawGod, setSawGod] = useState("");
  const [heldBack, setHeldBack] = useState("");
  const [building, setBuilding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      await api.reflect(date, "evening", { saw_god: sawGod, held_back: heldBack, building_toward: building });
      setSawGod("");
      setHeldBack("");
      setBuilding("");
      onClose();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Evening check-in">
      <Field label="Where did I see God today?" value={sawGod} onChangeText={setSawGod} placeholder="A kind word, a quiet moment…" />
      <Field label="What held me back?" value={heldBack} onChangeText={setHeldBack} placeholder="Be honest. This is private." />
      <Field label="I'm building toward…" value={building} onChangeText={setBuilding} placeholder="Who you're becoming" />
      <ErrorText>{error}</ErrorText>
      <Button title="Save reflection" onPress={save} loading={busy} disabled={!sawGod && !heldBack && !building} />
    </Sheet>
  );
}
