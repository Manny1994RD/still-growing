import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysLocal, greetingFor, localDate, parseDate, prettyDate } from "@/lib/date";
import { cachedToday, cacheToday, enqueue, isNetworkError, usePendingSync } from "@/lib/offline";
import type { CheckIn, DailyItem, Recap, TodayHabit, TodayResponse } from "@/lib/types";
import { CenterModal, useBurst } from "@/ui/celebrate";
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
  Row,
  SectionLabel,
  Sheet,
  SheetAction,
  Txt,
} from "@/ui/components";
import { HabitTimer } from "@/ui/HabitTimer";
import { SwipeRow } from "@/ui/SwipeRow";
import { radius, serif, space, useLayout, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const goalOf = (h: TodayHabit) => (h.type === "count" || h.type === "time" ? h.target : 1);
const PARTS = ["morning", "afternoon", "evening", "any"] as const;

function stateOf(h: TodayHabit): "empty" | "partial" | "done" | "slipped" | "rest" {
  const ci = h.check_in;
  if (!ci) return "empty";
  if (ci.status === "rest") return "rest";
  if (ci.status === "slipped") return "slipped";
  return ci.value >= goalOf(h) ? "done" : ci.value > 0 ? "partial" : "empty";
}

function subtitle(h: TodayHabit, s: Dict, categoryName: string): string {
  const parts: string[] = [];
  if (h.challenge_key && h.end_date) {
    const total = Math.round((parseDate(h.end_date).getTime() - parseDate(h.start_date).getTime()) / 86_400_000) + 1;
    // Compare calendar dates (not the clock) so the first day is "Day 1".
    const day = Math.round((parseDate(localDate()).getTime() - parseDate(h.start_date).getTime()) / 86_400_000) + 1;
    parts.push(s.v5.challengeDay(Math.min(Math.max(day, 1), total), total));
  } else {
    parts.push(categoryName);
  }
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
  const burst = useBurst();
  const { c } = useTheme();
  const { s, locale, category } = useI18n();
  const { wide } = useLayout();
  const realToday = localDate();
  const [date, setDate] = useState(realToday);
  const [data, setData] = useState<TodayResponse | null>(null);
  const [catNames, setCatNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<TodayHabit | null>(null);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [circle, setCircle] = useState<{ unread: number; prayers_today: number; prayed_by: string[] } | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [perfect, setPerfect] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const isToday = date === realToday;

  const load = useCallback(async () => {
    try {
      const [t, cs] = await Promise.all([api.today(date), api.categories()]);
      setData(t);
      void cacheToday(t);
      setCatNames(Object.fromEntries(cs.categories.map((x) => [x.id, x.name])));
      setError(null);
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) {
        setOffline(true);
        const cached = await cachedToday(date);
        if (cached) setData(cached);
      } else setError((e as Error).message);
    }
    api.circleSummary().then(setCircle, () => setCircle(null));
    const wd = new Date().getDay();
    if (wd === 0 || wd === 1) api.recap(localDate()).then(setRecap, () => setRecap(null));
  }, [date]);

  const pending = usePendingSync(load);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, user?.language]),
  );
  useEffect(() => {
    setData(null);
  }, [date]);

  const patchLocal = (id: string, ci: CheckIn | null, weekDelta = 0) =>
    setData((d) => {
      if (!d) return d;
      const next = {
        ...d,
        habits: d.habits.map((h) =>
          h.id === id ? { ...h, check_in: ci, week_done: h.week_done === null ? null : Math.max(0, h.week_done + weekDelta) } : h,
        ),
      };
      void cacheToday(next);
      return next;
    });

  async function set(h: TodayHabit, value: number, status: CheckIn["status"] = "done", note?: string) {
    const before = h.check_in;
    const wasCounted = before && before.status !== "slipped" && before.value > 0 ? 1 : 0;
    const nowCounted = status !== "slipped" && value > 0 ? 1 : 0;
    patchLocal(h.id, { habit_id: h.id, date, value, status, note: note ?? before?.note }, nowCounted - wasCounted);
    const reachedGoal = status === "done" && value >= goalOf(h) && (before?.value ?? 0) < goalOf(h);
    if (Platform.OS !== "web") void Haptics.impactAsync(reachedGoal ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    if (reachedGoal) burst();
    const undo = { label: s.v5.undo, onPress: () => (before ? void set(h, before.value, before.status, before.note) : void clear(h, true)) };
    try {
      const r = await api.checkIn(h.id, date, value, status, note);
      if (r.milestone) {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast({ title: s.today.milestone(r.milestone), text: r.message.text, ref: r.message.ref, action: undo });
      } else if (status === "rest") {
        toast({ text: s.today.rest, ref: s.today.restRef, action: undo });
      } else if (reachedGoal || status === "slipped") {
        const why = h.why ? `${h.why}\n` : "";
        toast({ text: `${why}${r.message.text}`, ref: r.message.ref, action: undo });
      } else if (note === undefined) {
        toast({ text: subtitle({ ...h, check_in: r.check_in }, s, category(h.category_id, catNames[h.category_id])), action: undo });
      }
      const badges = (r.achievements ?? []).filter((k) => k !== "perfect_day" && k !== "reward_reached");
      if (r.rewards?.length) setReward(r.rewards[0]!.title);
      else if (r.achievements?.includes("perfect_day") || (r.perfect_day && reachedGoal)) setPerfect(true);
      else if (badges.length) toast({ title: s.v5.newBadge(s.v5.badge[badges[0]!]?.name ?? badges[0]!), text: s.v5.badge[badges[0]!]?.desc ?? "", action: undo });
      void load();
    } catch (e) {
      if (isNetworkError(e)) {
        await enqueue({ kind: "checkin", habit_id: h.id, date, value, status, note });
        setOffline(true);
      } else {
        patchLocal(h.id, before);
        setError((e as Error).message);
      }
    }
  }

  async function clear(h: TodayHabit, silent = false) {
    const before = h.check_in;
    patchLocal(h.id, null, before && before.status !== "slipped" && before.value > 0 ? -1 : 0);
    try {
      await api.clearCheckIn(h.id, date);
      if (!silent && before) toast({ text: s.today.clearToday, action: { label: s.v5.undo, onPress: () => void set(h, before.value, before.status, before.note) } });
      void load();
    } catch (e) {
      if (isNetworkError(e)) {
        await enqueue({ kind: "clear", habit_id: h.id, date });
        setOffline(true);
      } else {
        patchLocal(h.id, before);
        setError((e as Error).message);
      }
    }
  }

  function primary(h: TodayHabit) {
    const st = stateOf(h);
    const v = h.check_in?.status === "done" ? h.check_in.value : 0;
    if (h.type === "count") return st === "done" ? setSheet(h) : set(h, v + 1);
    if (h.type === "time") return setSheet(h); // opens the timer / amount sheet
    return st === "empty" ? set(h, 1) : clear(h);
  }

  /** Swipe right = complete in one move (fills count/time goals too). */
  function swipe(h: TodayHabit) {
    if (stateOf(h) === "done") return;
    void set(h, goalOf(h));
  }

  const habits = data?.habits ?? [];
  const doneCount = habits.filter((h) => ["done", "rest"].includes(stateOf(h))).length;
  const showEvening = isToday && new Date().getHours() >= Number((user?.evening_time ?? "20:00").slice(0, 2));
  const groups = PARTS.map((p) => ({ part: p, items: habits.filter((h) => (h.part_of_day ?? "any") === p) })).filter((g) => g.items.length);
  const useGroups = groups.length > 1 || (groups[0] !== undefined && groups[0].part !== "any");
  const recapWeek = recap ? (new Date().getDay() === 1 ? recap.last_week : recap.this_week) : null;
  const dateLabel = isToday ? prettyDate(date, locale) : date === addDaysLocal(realToday, -1) ? s.v5.yesterday : prettyDate(date, locale);

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
          {offline || pending > 0 ? (
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", backgroundColor: c.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.lg }}>
              <Icon name={offline ? "wifi-off" : "refresh-cw"} size={16} />
              <Txt v="small" style={{ flex: 1 }}>
                {offline ? s.v5.offline : s.v5.syncing(pending)}
              </Txt>
            </View>
          ) : null}
          <Columns
            left={
              <>
                <Header
                  eyebrow={prettyDate(realToday, locale)}
                  title={`${greetingFor(s)},\n${user?.name || s.common.friend}.`}
                  right={<IconButton name="plus" label={s.habits.newHabit} onPress={() => router.push("/habit/new")} />}
                />
                {data ? <WordCard data={data} /> : null}

                {recapWeek && recapWeek.completions > 0 ? (
                  <Pressable onPress={() => router.push("/growth")} style={{ marginTop: space.md }}>
                    <Card style={{ gap: 4 }}>
                      <Txt v="caption" muted>
                        {s.v5.yourWeek}
                      </Txt>
                      <Txt>{s.v5.weekLine(recapWeek.days_showed_up, recapWeek.completions, recapWeek.perfect_days)}</Txt>
                      <Txt v="small" style={{ fontWeight: "600", marginTop: 4 }}>
                        {s.v5.seeRecap} →
                      </Txt>
                    </Card>
                  </Pressable>
                ) : null}

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

                {/* Day switcher: catch up on the last 7 days. */}
                <Row style={{ justifyContent: "space-between", marginTop: wide ? 0 : space.xl }}>
                  <IconButton
                    name="chevron-left"
                    label={s.v5.yesterday}
                    onPress={() => (date > addDaysLocal(realToday, -6) ? setDate(addDaysLocal(date, -1)) : undefined)}
                  />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Txt v="caption" muted>
                      {s.today.steps}
                    </Txt>
                    <Txt v="small" style={{ fontWeight: "600" }}>
                      {isToday ? s.tabs.today : dateLabel}
                    </Txt>
                  </View>
                  {isToday ? (
                    <View style={{ width: 44 }} />
                  ) : (
                    <IconButton name="chevron-right" label={s.v5.backToToday} onPress={() => setDate(addDaysLocal(date, 1))} />
                  )}
                </Row>
                <Row style={{ marginTop: space.md, marginBottom: space.sm }}>
                  <View style={{ flex: 1 }}>{habits.length ? <ProgressBar value={doneCount / habits.length} height={3} /> : null}</View>
                  {habits.length ? (
                    <Txt v="caption" muted style={{ marginLeft: space.md }}>{`${doneCount}/${habits.length}`}</Txt>
                  ) : null}
                </Row>
                {!isToday ? (
                  <Pressable onPress={() => setDate(realToday)} style={{ alignSelf: "center", padding: space.sm }}>
                    <Txt v="small" style={{ fontWeight: "600" }}>
                      {s.v5.backToToday}
                    </Txt>
                  </Pressable>
                ) : null}

                {data && habits.length === 0 ? (
                  <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.lg }}>
                    <Txt muted center>
                      {s.today.nothing}
                    </Txt>
                    <Button title={s.today.addHabit} icon="plus" small variant="secondary" onPress={() => router.push("/habit/new")} />
                  </View>
                ) : null}

                {(useGroups ? groups : [{ part: "any" as const, items: habits }]).map((g) => (
                  <View key={g.part}>
                    {useGroups ? (
                      <Txt v="caption" muted style={{ marginTop: space.lg }}>
                        {s.v5.partOfDay[g.part]}
                      </Txt>
                    ) : null}
                    {g.items.map((h) => (
                      <HabitRow
                        key={h.id}
                        h={h}
                        sub={subtitle(h, s, category(h.category_id, catNames[h.category_id]))}
                        onPress={() => primary(h)}
                        onMore={() => setSheet(h)}
                        onSwipe={() => swipe(h)}
                      />
                    ))}
                  </View>
                ))}

                {habits.length ? (
                  <Txt v="small" muted style={{ marginTop: space.md }}>
                    {s.v5.swipeHint}
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
        date={date}
        onClose={() => setSheet(null)}
        onSet={(h, v, st, note) => {
          setSheet(null);
          void set(h, v, st, note);
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
        date={date}
        onSaved={() => toast({ text: s.today.reflectionSaved, ref: s.today.reflectionRef })}
      />
      <CenterModal
        visible={perfect}
        onClose={() => setPerfect(false)}
        emoji="🌿"
        title={s.v5.perfectTitle}
        body={s.v5.perfectBody}
        refText={s.v5.perfectRef}
        button={s.v5.amen}
      />
      <CenterModal visible={!!reward} onClose={() => setReward(null)} emoji="🎁" title={s.v5.rewardTitle} body={s.v5.rewardBody(reward ?? "")} button={s.v5.amen} />
    </SafeAreaView>
  );
}

function HabitRow({ h, sub, onPress, onMore, onSwipe }: { h: TodayHabit; sub: string; onPress: () => void; onMore: () => void; onSwipe: () => void }) {
  const { c } = useTheme();
  const { s } = useI18n();
  const st = stateOf(h);
  const showBar = (h.type === "count" || h.type === "time") && st !== "done" && st !== "rest";
  const faded = st === "done" || st === "rest";
  return (
    <SwipeRow onSwipe={onSwipe} enabled={st !== "done"}>
      <Pressable
        onPress={onPress}
        onLongPress={onMore}
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
          <Row gap={6}>
            {h.emoji ? <Txt style={{ fontSize: 17 }}>{h.emoji}</Txt> : null}
            {h.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: h.color }} /> : null}
            <Txt v="heading" style={{ flexShrink: 1, color: faded ? c.muted : c.ink }} numberOfLines={1}>
              {h.name}
            </Txt>
          </Row>
          <Txt v="small" muted numberOfLines={1}>
            {sub}
          </Txt>
          {h.check_in?.note ? (
            <Txt v="small" style={{ fontStyle: "italic" }} numberOfLines={1}>
              “{h.check_in.note}”
            </Txt>
          ) : null}
          {showBar ? (
            <View style={{ marginTop: 6 }}>
              <ProgressBar value={(h.check_in?.value ?? 0) / goalOf(h)} height={3} />
            </View>
          ) : null}
        </View>
        <Pressable hitSlop={12} onPress={onMore} accessibilityLabel={s.today.moreFor(h.name)}>
          <Icon name="more-horizontal" color={c.muted} />
        </Pressable>
      </Pressable>
    </SwipeRow>
  );
}

function HabitSheet({
  habit: h,
  date,
  onClose,
  onSet,
  onClear,
  onEdit,
}: {
  habit: TodayHabit | null;
  date: string;
  onClose: () => void;
  onSet: (h: TodayHabit, value: number, status?: CheckIn["status"], note?: string) => void;
  onClear: (h: TodayHabit) => void;
  onEdit: (h: TodayHabit) => void;
}) {
  const { s } = useI18n();
  const { c } = useTheme();
  const t = s.today;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    setAmount(h ? String(h.check_in?.status === "done" ? h.check_in.value : 0) : "");
    setNote(h?.check_in?.note ?? "");
  }, [h]);
  if (!h) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const v = h.check_in?.status === "done" ? h.check_in.value : 0;
  const status = h.check_in?.status ?? "done";
  return (
    <Sheet visible onClose={onClose} title={`${h.emoji ? `${h.emoji} ` : ""}${h.name}`}>
      {h.why ? (
        <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.md }}>
          <Txt v="caption" muted>
            {s.v5.myWhy}
          </Txt>
          <Txt style={{ fontFamily: serif }}>{h.why}</Txt>
        </View>
      ) : null}

      {h.type === "time" ? <HabitTimer habitId={h.id} date={date} onFinish={(m) => onSet(h, v + m)} /> : null}

      {h.type === "count" || h.type === "time" ? (
        <>
          <Row gap={space.sm} style={{ alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field
                label={`${s.v5.setAmount} (${h.unit || (h.type === "time" ? "min" : "")})`}
                value={amount}
                onChangeText={(x) => setAmount(x.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={{ marginBottom: space.lg }}>
              <Button title={s.v5.saveAmount} small onPress={() => onSet(h, Number(amount || 0))} />
            </View>
          </Row>
          <Row gap={space.sm} style={{ flexWrap: "wrap", marginBottom: space.sm }}>
            {h.type === "count" ? (
              <>
                <Button title="+1" small variant="secondary" onPress={() => onSet(h, v + 1)} />
                {v > 0 ? <Button title="−1" small variant="secondary" onPress={() => onSet(h, v - 1)} /> : null}
              </>
            ) : (
              <>
                <Button title="+5" small variant="secondary" onPress={() => onSet(h, v + 5)} />
                <Button title="+15" small variant="secondary" onPress={() => onSet(h, v + 15)} />
              </>
            )}
            <Button title={t.completeGoal(h.target, h.type === "time" ? "min" : "")} small variant="secondary" icon="check" onPress={() => onSet(h, Math.max(v, h.target))} />
          </Row>
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

      <Field label={s.v5.note} value={note} onChangeText={setNote} placeholder={s.v5.notePh} maxLength={300} />
      {note !== (h.check_in?.note ?? "") ? (
        <View style={{ marginTop: -space.sm, marginBottom: space.md }}>
          <Button title={s.v5.saveNote} small variant="secondary" onPress={() => onSet(h, h.check_in ? h.check_in.value : 0, status, note)} />
        </View>
      ) : null}

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
