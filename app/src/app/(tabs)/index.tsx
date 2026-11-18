import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { greetingFor, localDate, prettyDate } from "@/lib/date";
import type { CheckIn, DailyItem, TodayHabit, TodayResponse } from "@/lib/types";
import {
  Button,
  Card,
  Check,
  Columns,
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
} from "@/ui/components";
import { radius, serif, space, useLayout, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const goalOf = (h: TodayHabit) => (h.type === "count" || h.type === "time" ? h.target : 1);

function stateOf(h: TodayHabit): "empty" | "partial" | "done" | "slipped" | "rest" {
  const ci = h.check_in;
  if (!ci) return "empty";
  if (ci.status === "rest") return "rest";
  if (ci.status === "slipped") return "slipped";
  return ci.value >= goalOf(h) ? "done" : ci.value > 0 ? "partial" : "empty";
}

function subtitle(h: TodayHabit, s: Dict, categoryName: string): string {
  const parts: string[] = [categoryName];
  const v = h.check_in?.value ?? 0;
  if (h.type === "count" || h.type === "time") parts.push(s.today.of(Math.min(v, 9999), h.target, h.unit || (h.type === "time" ? "min" : "")));
  if (h.type === "weekly") parts.push(s.today.thisWeek(h.week_done ?? 0, h.target));
  if (h.type === "refrain") parts.push(h.check_in?.status === "slipped" ? s.today.newStart : s.today.daysFree(h.days_free ?? 0));
  if (h.streak > 1 && h.type !== "refrain") parts.push(s.today.streak(h.streak, h.type === "weekly"));
  return parts.join(" · ");
}

export default function Today() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { s, locale, category } = useI18n();
  const { wide } = useLayout();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [catNames, setCatNames] = useState<Record<string, string>>({});
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
      setCatNames(Object.fromEntries(cs.categories.map((x) => [x.id, x.name])));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    api.circleSummary().then(setCircle, () => setCircle(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, user?.language]),
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
        toast({ title: s.today.milestone(r.milestone), text: r.message.text, ref: r.message.ref });
      } else if (status === "rest") {
        toast({ text: s.today.rest, ref: s.today.restRef });
      } else if (reachedGoal || status === "slipped") {
        toast({ text: r.message.text, ref: r.message.ref });
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
    const st = stateOf(h);
    const v = h.check_in?.status === "done" ? h.check_in.value : 0;
    if (h.type === "count") return st === "done" ? setSheet(h) : set(h, v + 1);
    if (h.type === "time") return st === "done" ? setSheet(h) : set(h, Math.min(v + 5, h.target));
    return st === "empty" ? set(h, 1) : clear(h);
  }

  const habits = data?.habits ?? [];
  const doneCount = habits.filter((h) => ["done", "rest"].includes(stateOf(h))).length;
  const showEvening = new Date().getHours() >= Number((user?.evening_time ?? "20:00").slice(0, 2));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={{ width: "100%", maxWidth: wide ? 1080 : 560, alignSelf: "center", paddingHorizontal: wide ? space.xxl : space.xl }}>
          <Columns
            left={
          <>
          <Header
            eyebrow={prettyDate(today, locale)}
            title={`${greetingFor(s)},\n${user?.name || s.common.friend}.`}
            right={<IconButton name="plus" label={s.habits.newHabit} onPress={() => router.push("/habit/new")} />}
          />

          {data ? <WordCard data={data} /> : null}

          {circle && (circle.prayers_today > 0 || circle.unread > 0) ? (
            <Pressable onPress={() => router.push("/circle")} style={{ marginTop: space.md }}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg }}>
                <Icon name="heart" />
                <Txt style={{ flex: 1 }}>
                  {circle.prayers_today > 0
                    ? s.today.prayedForYou(circle.prayed_by.slice(0, 2), circle.prayers_today > 2)
                    : s.today.newEncouragements(circle.unread)}
                </Txt>
                <Icon name="chevron-right" color={c.muted} />
              </Card>
            </Pressable>
          ) : null}

          </>
            }
            right={
          <>
          <ErrorText>{error}</ErrorText>

          <SectionLabel right={habits.length ? <Txt v="caption" muted>{`${doneCount}/${habits.length}`}</Txt> : undefined}>
            {s.today.steps}
          </SectionLabel>
          {habits.length ? <ProgressBar value={doneCount / habits.length} height={3} /> : null}
          <Spacer h={space.sm} />

          {data && habits.length === 0 ? (
            <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.lg }}>
              <Txt muted center>
                {s.today.nothing}
              </Txt>
              <Button title={s.today.addHabit} icon="plus" small variant="secondary" onPress={() => router.push("/habit/new")} />
            </View>
          ) : null}

          {habits.map((h) => {
            const st = stateOf(h);
            const showBar = (h.type === "count" || h.type === "time") && st !== "done" && st !== "rest";
            return (
              <Pressable
                key={h.id}
                onPress={() => primary(h)}
                onLongPress={() => setSheet(h)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityState={{ checked: st === "done" }}
                accessibilityLabel={h.name}
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
                <Check state={st} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="heading" style={st === "done" || st === "rest" ? { color: c.muted } : undefined}>
                    {h.name}
                  </Txt>
                  <Txt v="small" muted numberOfLines={1}>
                    {subtitle(h, s, category(h.category_id, catNames[h.category_id]))}
                  </Txt>
                  {showBar ? (
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar value={(h.check_in?.value ?? 0) / goalOf(h)} height={3} />
                    </View>
                  ) : null}
                </View>
                <Pressable hitSlop={12} onPress={() => setSheet(h)} accessibilityLabel={s.today.moreFor(h.name)}>
                  <Icon name="more-horizontal" color={c.muted} />
                </Pressable>
              </Pressable>
            );
          })}

          {habits.length ? (
            <Txt v="small" muted style={{ marginTop: space.md }}>
              {s.today.hint}
            </Txt>
          ) : null}

          {showEvening && habits.length ? (
            <>
              <SectionLabel>{s.today.eveningLabel}</SectionLabel>
              <Pressable onPress={() => setReflectOpen(true)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
                  <Icon name="moon" />
                  <View style={{ flex: 1 }}>
                    <Txt v="heading">{s.today.eveningCheckIn}</Txt>
                    <Txt v="small" muted>
                      {s.today.quietMinute}
                    </Txt>
                  </View>
                  <Icon name="chevron-right" color={c.muted} />
                </Card>
              </Pressable>
            </>
          ) : null}
          </>
            }
          />
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
      <ReflectSheet
        visible={reflectOpen}
        onClose={() => setReflectOpen(false)}
        date={today}
        onSaved={() => toast({ text: s.today.reflectionSaved, ref: s.today.reflectionRef })}
      />
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
  const { s } = useI18n();
  const t = s.today;
  if (!h) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const v = h.check_in?.status === "done" ? h.check_in.value : 0;
  return (
    <Sheet visible onClose={onClose} title={h.name}>
      {h.type === "count" ? (
        <>
          <SheetAction icon="plus" label={t.add(h.unit)} onPress={() => onSet(h, v + 1)} />
          {v > 0 ? <SheetAction icon="minus" label={t.removeOne(h.unit)} onPress={() => onSet(h, v - 1)} /> : null}
          <SheetAction icon="check-circle" label={t.completeGoal(h.target, "")} onPress={() => onSet(h, Math.max(v, h.target))} />
        </>
      ) : null}
      {h.type === "time" ? (
        <>
          <SheetAction icon="plus" label={t.addMinutes(5)} onPress={() => onSet(h, v + 5)} />
          <SheetAction icon="plus" label={t.addMinutes(15)} onPress={() => onSet(h, v + 15)} />
          <SheetAction icon="check-circle" label={t.completeGoal(h.target, "min")} onPress={() => onSet(h, Math.max(v, h.target))} />
        </>
      ) : null}
      {h.type === "do" || h.type === "weekly" ? <SheetAction icon="check-circle" label={t.markDone} onPress={() => onSet(h, 1)} /> : null}
      {h.type === "refrain" ? (
        <>
          <SheetAction icon="shield" label={t.stayedFree} onPress={() => onSet(h, 1)} />
          <SheetAction icon="rotate-ccw" label={t.slipped} onPress={() => onSet(h, 0, "slipped")} />
        </>
      ) : (
        <SheetAction icon="moon" label={t.restDay} onPress={() => onSet(h, 0, "rest")} />
      )}
      {h.check_in ? <SheetAction icon="x" label={t.clearToday} onPress={() => onClear(h)} /> : null}
      <SheetAction icon="edit-2" label={t.editHabit} onPress={() => onEdit(h)} />
    </Sheet>
  );
}

function ReflectSheet({ visible, onClose, date, onSaved }: { visible: boolean; onClose: () => void; date: string; onSaved: () => void }) {
  const { s } = useI18n();
  const t = s.today;
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
    <Sheet visible={visible} onClose={onClose} title={t.eveningCheckIn}>
      <Field label={t.sawGod} value={sawGod} onChangeText={setSawGod} placeholder={t.sawGodPh} />
      <Field label={t.heldBack} value={heldBack} onChangeText={setHeldBack} placeholder={t.heldBackPh} />
      <Field label={t.building} value={building} onChangeText={setBuilding} placeholder={t.buildingPh} />
      <ErrorText>{error}</ErrorText>
      <Button title={t.saveReflection} onPress={save} loading={busy} disabled={!sawGod && !heldBack && !building} />
    </Sheet>
  );
}

/**
 * "A word for you today": verses and words of encouragement (written as God
 * speaking, each based on a verse). Tap "Another word" to see the next one.
 */
function WordCard({ data }: { data: TodayResponse }) {
  const { c } = useTheme();
  const { s } = useI18n();
  const items: DailyItem[] = data.words?.length ? data.words : [{ kind: "verse", id: data.verse.ref, text: data.verse.text, ref: data.verse.ref }];
  const [i, setI] = useState(0);
  const item = items[i % items.length]!;
  const isWord = item.kind === "word";
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl }}>
      <Txt v="caption" muted style={{ marginBottom: space.md }}>
        {isWord ? s.word.title : s.word.verseTitle}
      </Txt>
      <Txt style={{ fontFamily: serif, fontSize: isWord ? 21 : 19, lineHeight: isWord ? 30 : 28, fontStyle: isWord ? "normal" : "italic" }}>
        {isWord ? item.text : `“${item.text}”`}
      </Txt>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.lg, gap: space.md }}>
        <Txt v="small" muted style={{ flex: 1 }}>
          {isWord ? s.word.inspired(item.ref) : item.ref}
        </Txt>
        {items.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setI(i + 1)}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.5 : 1 })}
          >
            <Icon name="refresh-cw" size={14} />
            <Txt v="small" style={{ fontWeight: "600" }}>
              {s.word.another}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
