import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { api } from "@/lib/api";
import { formatTime, scheduleLabel } from "@/lib/date";
import type { Category, Habit } from "@/lib/types";
import { Button, ErrorText, Header, Icon, IconButton, Row, Screen, SectionLabel, Txt } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

function detail(h: Habit, s: Dict, locale: string): string {
  const parts = [s.types[h.type].label];
  if (h.type === "count" || h.type === "time") parts.push(`${h.target} ${h.unit || (h.type === "time" ? "min" : "")}`.trim());
  if (h.type === "weekly") parts.push(s.schedule.perWeek(h.target));
  else parts.push(scheduleLabel(h.days_mask, s));
  if (h.reminder_time) parts.push(formatTime(h.reminder_time, locale));
  return parts.join(" · ");
}

export default function Habits() {
  const router = useRouter();
  const { c } = useTheme();
  const { s, locale, category } = useI18n();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.habits(), api.categories()])
        .then(([h, cs]) => {
          setHabits(h.habits);
          setCategories(cs.categories);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, []),
  );

  const groups = categories
    .map((cat) => ({ cat, items: (habits ?? []).filter((h) => h.category_id === cat.id) }))
    .filter((g) => g.items.length);

  return (
    <Screen>
      <Header
        eyebrow={s.habits.active(habits?.length ?? 0)}
        title={s.habits.title}
        right={<IconButton name="plus" label={s.habits.newHabit} onPress={() => router.push("/habit/new")} />}
      />
      <ErrorText>{error}</ErrorText>

      {habits && habits.length === 0 ? (
        <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.lg }}>
          <Txt muted center>
            {s.habits.empty}
          </Txt>
          <Button title={s.habits.create} icon="plus" small onPress={() => router.push("/habit/new")} />
        </View>
      ) : null}

      {groups.map(({ cat, items }) => (
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
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
                <Icon name={cat.icon} size={18} />
              </View>
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
      ))}
    </Screen>
  );
}
