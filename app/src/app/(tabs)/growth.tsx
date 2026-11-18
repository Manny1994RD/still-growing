import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Share, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { localDate, parseDate } from "@/lib/date";
import type { Achievement, Habit, Recap, RewardGoal, Stats, WeekSummary } from "@/lib/types";
import {
  Button,
  Card,
  Chip,
  Columns,
  ErrorText,
  Field,
  Header,
  Icon,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Segmented,
  Sheet,
  Spacer,
  Txt,
  Wrap,
} from "@/ui/components";
import { Plant } from "@/ui/Plant";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const SEASON_ORDER = ["seed", "sprout", "rooted", "fruitful", "overflowing"];
const BADGE_EMOJI: Record<string, string> = {
  first_step: "👣",
  perfect_day: "🌿",
  week: "📅",
  faithful_little: "🌱",
  days_21: "🔥",
  days_40: "⛰️",
  days_100: "🏆",
  prayer_warrior: "🙏",
  challenge_done: "🏁",
  reward_reached: "🎁",
};

export default function Growth() {
  const { c } = useTheme();
  const { s, category } = useI18n();
  const g = s.growth;
  const v = s.v5;
  const [stats, setStats] = useState<Stats | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [badges, setBadges] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<RewardGoal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [week, setWeek] = useState<"this" | "last">("this");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = localDate();
    try {
      const [st, rc, ac, rw, hb] = await Promise.all([api.stats(today), api.recap(today), api.achievements(), api.rewards(today), api.habits()]);
      setStats(st);
      setRecap(rc);
      setBadges(ac.achievements);
      setRewards(rw.rewards);
      setHabits(hb.habits);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const season = s.seasons[stats?.season ?? "seed"]!;
  const seasonIdx = SEASON_ORDER.indexOf(stats?.season ?? "seed");
  const todayRow = stats?.history[stats.history.length - 1];
  const hist = stats?.history ?? [];
  const firstWeekday = hist.length ? parseDate(hist[0]!.date).getDay() : 0;
  const today = localDate();
  const shownWeek: WeekSummary | null = recap ? (week === "this" ? recap.this_week : recap.last_week) : null;

  async function shareGrowth() {
    if (!stats) return;
    const areas = stats.categories.filter((x) => x.id !== "freedom").map((x) => category(x.id, x.name));
    await Share.share({ message: g.shareMessage(season.title, stats.days_showed_up, stats.streak.current, stats.faithfulness, areas, "") });
  }

  async function removeReward(r: RewardGoal) {
    const ok =
      Platform.OS === "web"
        ? (globalThis.confirm?.(`${s.common.delete}: ${r.title}?`) ?? false)
        : await new Promise<boolean>((res) =>
            Alert.alert(r.title, "", [
              { text: s.common.cancel, style: "cancel", onPress: () => res(false) },
              { text: s.common.delete, style: "destructive", onPress: () => res(true) },
            ]),
          );
    if (!ok) return;
    await api.deleteReward(r.id).catch(() => {});
    void load();
  }

  return (
    <Screen wide>
      <Columns
        left={
          <>
            <Header eyebrow={g.eyebrow} title={season.title} />
            <Card style={{ alignItems: "center", paddingVertical: space.lg }}>
              <Plant season={stats?.season ?? "seed"} water={todayRow && todayRow.due ? todayRow.kept / todayRow.due : 0} />
              <Txt muted center>
                {season.line}
              </Txt>
              {todayRow && todayRow.due ? (
                <Txt v="small" muted style={{ marginTop: 4 }}>
                  {v.watering(todayRow.kept, todayRow.due)}
                </Txt>
              ) : null}
              <Row gap={6} style={{ marginTop: space.lg, alignSelf: "stretch" }}>
                {SEASON_ORDER.map((sn, i) => (
                  <View key={sn} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= seasonIdx ? c.ink : c.hairline }} />
                ))}
              </Row>
            </Card>
            <ErrorText>{error}</ErrorText>

            <SectionLabel>{g.last30}</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              <Stat label={g.faithfulness} value={stats?.faithfulness == null ? "—" : `${stats.faithfulness}%`} />
              <Stat label={g.currentStreak} value={`${stats?.streak.current ?? 0}`} suffix={s.common.days(stats?.streak.current ?? 0)} />
              <Stat label={g.daysShowedUp} value={`${stats?.days_showed_up ?? 0}`} />
              <Stat label={g.longestStreak} value={`${stats?.streak.longest ?? 0}`} suffix={s.common.days(stats?.streak.longest ?? 0)} />
            </View>
            {stats?.streak.graceUsedThisWeek ? (
              <Row style={{ marginTop: space.md }} gap={space.sm}>
                <Icon name="feather" size={14} color={c.muted} />
                <Txt v="small" muted style={{ flex: 1 }}>
                  {g.grace}
                </Txt>
              </Row>
            ) : null}

            {shownWeek ? (
              <>
                <SectionLabel>{v.yourWeek}</SectionLabel>
                <Segmented<"this" | "last">
                  value={week}
                  onChange={setWeek}
                  options={[
                    { value: "this", label: v.thisWeek },
                    { value: "last", label: v.lastWeek },
                  ]}
                />
                <Card style={{ marginTop: space.md }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    {[
                      [shownWeek.days_showed_up, v.daysShowedUp],
                      [shownWeek.completions, v.completed],
                      [shownWeek.perfect_days, v.perfectDays],
                    ].map(([n, l]) => (
                      <View key={String(l)} style={{ flex: 1 }}>
                        <Txt v="title">{n}</Txt>
                        <Txt v="small" muted>
                          {l}
                        </Txt>
                      </View>
                    ))}
                  </Row>
                  {shownWeek.top.length ? (
                    <>
                      <Txt v="caption" muted style={{ marginTop: space.lg, marginBottom: space.sm }}>
                        {v.topHabits}
                      </Txt>
                      {shownWeek.top.map((t) => (
                        <Row key={t.id} style={{ justifyContent: "space-between", paddingVertical: 4 }}>
                          <Txt numberOfLines={1} style={{ flex: 1 }}>
                            {t.emoji ? `${t.emoji} ` : ""}
                            {t.name}
                          </Txt>
                          <Txt v="small" muted>
                            ×{t.count}
                          </Txt>
                        </Row>
                      ))}
                    </>
                  ) : null}
                  <Spacer h={space.md} />
                  <Button
                    title={v.shareRecap}
                    small
                    variant="ghost"
                    icon="share"
                    onPress={() => Share.share({ message: v.recapShare(shownWeek.days_showed_up, shownWeek.completions, shownWeek.perfect_days) })}
                  />
                </Card>
              </>
            ) : null}

            <SectionLabel>{g.fiveWeeks}</SectionLabel>
            <Card>
              <Row gap={8} style={{ marginBottom: space.md }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <Txt key={i} v="caption" muted style={{ flex: 1, textAlign: "center" }}>
                    {s.schedule.letters[(firstWeekday + i) % 7]}
                  </Txt>
                ))}
              </Row>
              <View style={{ gap: 8 }}>
                {Array.from({ length: Math.ceil(hist.length / 7) }, (_, row) => (
                  <Row key={row} gap={8}>
                    {hist.slice(row * 7, row * 7 + 7).map((d) => {
                      const r = d.due ? d.kept / d.due : 0;
                      const isToday = d.date === today;
                      return (
                        <View
                          key={d.date}
                          accessibilityLabel={`${d.date}: ${d.kept}/${d.due}`}
                          style={{
                            flex: 1,
                            aspectRatio: 1,
                            borderRadius: radius.sm,
                            backgroundColor: d.due === 0 || r === 0 ? "transparent" : c.ink,
                            opacity: r === 0 ? 1 : 0.3 + r * 0.7,
                            borderWidth: isToday ? 1.5 : r === 0 ? 1 : 0,
                            borderColor: isToday ? c.ink : c.hairline,
                          }}
                        />
                      );
                    })}
                  </Row>
                ))}
              </View>
            </Card>
          </>
        }
        right={
          <>
            <SectionLabel right={<IconButton name="plus" label={v.addReward} onPress={() => setRewardOpen(true)} />}>{v.rewards}</SectionLabel>
            {rewards.length === 0 ? (
              <Pressable onPress={() => setRewardOpen(true)}>
                <Card>
                  <Txt>🎁 {v.addReward}</Txt>
                  <Txt v="small" muted style={{ marginTop: 4 }}>
                    {v.rewardIntro}
                  </Txt>
                </Card>
              </Pressable>
            ) : (
              rewards.map((r) => (
                <Pressable key={r.id} onLongPress={() => removeReward(r)} style={{ marginBottom: space.md }}>
                  <Card>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt v="heading" style={{ flex: 1 }} numberOfLines={1}>
                        🎁 {r.title}
                      </Txt>
                      {r.achieved_at ? (
                        <Txt v="small" style={{ fontWeight: "700" }}>
                          {v.reached}
                        </Txt>
                      ) : (
                        <Pressable onPress={() => removeReward(r)} hitSlop={8} accessibilityLabel={s.common.delete}>
                          <Icon name="x" size={16} color={c.muted} />
                        </Pressable>
                      )}
                    </Row>
                    <Txt v="small" muted style={{ marginVertical: 6 }}>
                      {r.habit_name ?? v.anyHabit} · {v.progressDays(r.progress, r.target_days)}
                    </Txt>
                    <ProgressBar value={r.progress / r.target_days} />
                  </Card>
                </Pressable>
              ))
            )}

            <SectionLabel>{v.badges}</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              {badges.map((b) => {
                const info = v.badge[b.key] ?? { name: b.key, desc: "" };
                const on = !!b.unlocked_at;
                return (
                  <View
                    key={b.key}
                    accessibilityLabel={`${info.name}: ${on ? info.desc : v.locked}`}
                    style={{
                      flexBasis: "30%",
                      flexGrow: 1,
                      alignItems: "center",
                      padding: space.md,
                      borderRadius: radius.md,
                      backgroundColor: on ? c.surface : "transparent",
                      borderWidth: on ? 0 : 1,
                      borderColor: c.hairline,
                      opacity: on ? 1 : 0.45,
                    }}
                  >
                    <Txt style={{ fontSize: 28, lineHeight: 34 }}>{on ? BADGE_EMOJI[b.key] ?? "⭐" : "🔒"}</Txt>
                    <Txt v="small" center style={{ fontWeight: "600", marginTop: 4 }} numberOfLines={2}>
                      {info.name}
                    </Txt>
                    <Txt v="small" muted center numberOfLines={2} style={{ fontSize: 11, lineHeight: 14 }}>
                      {on ? info.desc : v.locked}
                    </Txt>
                  </View>
                );
              })}
            </View>

            {stats?.categories.length ? (
              <>
                <SectionLabel>{g.balance}</SectionLabel>
                {stats.categories.map((cat) => (
                  <View key={cat.id} style={{ marginBottom: space.lg }}>
                    <Row style={{ justifyContent: "space-between", marginBottom: space.sm }}>
                      <Row gap={space.sm}>
                        <Icon name={cat.icon} size={16} />
                        <Txt v="heading" style={{ fontSize: 15 }}>
                          {category(cat.id, cat.name)}
                        </Txt>
                      </Row>
                      <Txt v="small" muted>
                        {cat.faithfulness === null ? g.new : `${cat.faithfulness}%`}
                      </Txt>
                    </Row>
                    <ProgressBar value={(cat.faithfulness ?? 0) / 100} />
                  </View>
                ))}
              </>
            ) : null}

            <Spacer h={space.xl} />
            <Button title={g.share} icon="share" variant="secondary" onPress={shareGrowth} disabled={!stats} />
            <Spacer h={space.sm} />
            <Txt v="small" muted center>
              {g.shareNote}
            </Txt>
          </>
        }
      />
      <RewardSheet visible={rewardOpen} habits={habits} onClose={() => setRewardOpen(false)} onSaved={load} />
    </Screen>
  );
}

function RewardSheet({ visible, habits, onClose, onSaved }: { visible: boolean; habits: Habit[]; onClose: () => void; onSaved: () => void }) {
  const { s } = useI18n();
  const toast = useToast();
  const v = s.v5;
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("30");
  const [habitId, setHabitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.createReward({ title: title.trim(), target_days: Math.max(1, Number(days) || 1), habit_id: habitId });
      setTitle("");
      setHabitId(null);
      onClose();
      toast({ text: `🎁 ${title.trim()}` });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={v.addReward}>
      <Txt muted>{v.rewardIntro}</Txt>
      <Spacer h={space.lg} />
      <Field label={v.rewardTitleLabel} value={title} onChangeText={setTitle} placeholder={v.rewardPh} maxLength={120} />
      <Txt v="caption" muted style={{ marginBottom: space.sm }}>
        {v.rewardDays}
      </Txt>
      <Wrap>
        {["7", "21", "30", "40", "100"].map((d) => (
          <Chip key={d} label={d} selected={days === d} onPress={() => setDays(d)} />
        ))}
      </Wrap>
      <Spacer h={space.md} />
      <Field value={days} onChangeText={(x) => setDays(x.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={4} />
      <Txt v="caption" muted style={{ marginBottom: space.sm }}>
        {v.rewardHabit}
      </Txt>
      <Wrap>
        <Chip label={v.anyHabit} selected={habitId === null} onPress={() => setHabitId(null)} />
        {habits.map((h) => (
          <Chip key={h.id} label={`${h.emoji ? `${h.emoji} ` : ""}${h.name}`} selected={habitId === h.id} onPress={() => setHabitId(h.id)} />
        ))}
      </Wrap>
      <Spacer h={space.lg} />
      <ErrorText>{error}</ErrorText>
      <Button title={s.common.save} onPress={save} loading={busy} disabled={!title.trim() || !Number(days)} />
    </Sheet>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg + 2 }}>
      <Row gap={6} style={{ alignItems: "baseline" }}>
        <Txt v="number">{value}</Txt>
        {suffix ? (
          <Txt v="small" muted>
            {suffix}
          </Txt>
        ) : null}
      </Row>
      <Txt v="small" muted style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}
