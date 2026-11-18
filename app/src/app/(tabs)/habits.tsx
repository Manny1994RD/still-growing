import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { api } from "@/lib/api";
import { formatTime, parseDate, scheduleLabel } from "@/lib/date";
import type { Category, Habit } from "@/lib/types";
import { Button, ErrorText, Header, Icon, IconButton, Row, Screen, SectionLabel, Txt } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

function detail(h: Habit, s: Dict, locale: string): string {
  const parts = [s.types[h.type].label];
  if (h.type === "count" || h.type === "time") parts.push(`${h.target} ${h.unit || (h.type === "time" ? "min" : "")}`.trim());
  if (h.type === "weekly") parts.push(s.schedule.perWeek(h.target));
  else parts.push(scheduleLabel(h.days_mask, s));
  const times = h.reminders?.length ? h.reminders : h.reminder_time ? [h.reminder_time] : [];
  if (times.length === 1) parts.push(formatTime(times[0]!, locale));
  else if (times.length > 1) parts.push(`🔔 ${times.length}`);
  if (h.end_date) parts.push(s.v5.ends(parseDate(h.end_date).toLocaleDateString(locale, { month: "short", day: "numeric" })));
  return parts.join(" · ");
}

export default function Habits() {
  const router = useRouter();
  const { c } = useTheme();
  const { s, locale, category } = useI18n();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.habits(), api.categories()])
      .then(([h, cs]) => {
        setHabits(h.habits);
        setCategories(cs.categories);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function move(i: number, dir: -1 | 1) {
    if (!habits) return;
    const j = i + dir;
    if (j < 0 || j >= habits.length) return;
    const next = [...habits];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setHabits(next);
    void api.reorderHabits(next.map((h) => h.id)).catch((e) => setError(e.message));
  }

  const groups = categories
    .map((cat) => ({ cat, items: (habits ?? []).filter((h) => h.category_id === cat.id) }))
    .filter((g) => g.items.length);

  const leading = (h: Habit, cat?: Category) => (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: h.color ? 2 : 0,
        borderColor: h.color || "transparent",
      }}
    >
      {h.emoji ? <Txt style={{ fontSize: 18, lineHeight: 24 }}>{h.emoji}</Txt> : <Icon name={cat?.icon ?? "circle"} size={18} />}
    </View>
  );

  return (
    <Screen>
      <Header
        eyebrow={s.habits.active(habits?.length ?? 0)}
        title={s.habits.title}
        right={
          <Row gap={space.sm}>
            {habits && habits.length > 1 ? (
              <IconButton name={reorder ? "check" : "move"} label={reorder ? s.v5.doneReorder : s.v5.reorder} onPress={() => setReorder(!reorder)} />
            ) : null}
            <IconButton name="plus" label={s.habits.newHabit} onPress={() => router.push("/habit/new")} />
          </Row>
        }
      />
      <ErrorText>{error}</ErrorText>

      <Pressable onPress={() => router.push("/challenges")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: space.md })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: 16, borderWidth: 1, borderColor: c.hairline }}>
          <Txt style={{ fontSize: 24 }}>🏁</Txt>
          <View style={{ flex: 1 }}>
            <Txt v="heading">{s.v5.challenges}</Txt>
            <Txt v="small" muted numberOfLines={2}>
              {s.v5.challengesIntro}
            </Txt>
          </View>
          <Icon name="chevron-right" color={c.muted} />
        </View>
      </Pressable>

      {habits && habits.length === 0 ? (
        <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.lg }}>
          <Txt muted center>
            {s.habits.empty}
          </Txt>
          <Button title={s.habits.create} icon="plus" small onPress={() => router.push("/habit/new")} />
        </View>
      ) : null}

      {reorder && habits ? (
        <>
          <SectionLabel>{s.v5.reorder}</SectionLabel>
          {habits.map((h, i) => (
            <Row key={h.id} gap={space.md} style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.hairline }}>
              {leading(h, categories.find((x) => x.id === h.category_id))}
              <Txt v="heading" style={{ flex: 1 }} numberOfLines={1}>
                {h.name}
              </Txt>
              <IconButton name="arrow-up" label={s.v5.moveUp} onPress={() => move(i, -1)} />
              <IconButton name="arrow-down" label={s.v5.moveDown} onPress={() => move(i, 1)} />
            </Row>
          ))}
        </>
      ) : (
        groups.map(({ cat, items }) => (
          <View key={cat.id}>
            <SectionLabel
              right={
                cat.private_by_default ? (
                  <Row gap={4}>
                    <Icon name="lock" size={12} color={c.muted} />
                    <Txt v="caption" muted>
                      {s.habits.private}
                    </Txt>
                  </Row>
                ) : undefined
              }
            >
              {category(cat.id, cat.name)}
            </SectionLabel>
            {items.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => router.push(`/habit/${h.id}`)}
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
                {leading(h, cat)}
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="heading">{h.name}</Txt>
                  <Txt v="small" muted numberOfLines={1}>
                    {detail(h, s, locale)}
                  </Txt>
                </View>
                <Icon name="chevron-right" color={c.muted} />
              </Pressable>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
