import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@/lib/api";
import { formatTime, scheduleLabel } from "@/lib/date";
import { TYPE_LABELS } from "@/lib/suggestions";
import type { Category, Habit } from "@/lib/types";
import { Button, ErrorText, Header, Icon, IconButton, Row, Screen, SectionLabel, Txt } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

function detail(h: Habit): string {
  const parts = [TYPE_LABELS[h.type].label];
  if (h.type === "count" || h.type === "time") parts.push(`${h.target} ${h.unit || (h.type === "time" ? "min" : "")}`.trim());
  if (h.type === "weekly") parts.push(`${h.target}× a week`);
  else parts.push(scheduleLabel(h.days_mask));
  if (h.reminder_time) parts.push(formatTime(h.reminder_time));
  return parts.join(" · ");
}

export default function Habits() {
  const router = useRouter();
  const { c } = useTheme();
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
      <Header eyebrow={`${habits?.length ?? 0} active`} title="Habits" right={<IconButton name="plus" label="New habit" onPress={() => router.push("/habit/new")} />} />
      <ErrorText>{error}</ErrorText>

      {habits && habits.length === 0 ? (
        <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.lg }}>
          <Txt muted center>
            No habits yet. Start with one small step.
          </Txt>
          <Button title="Create a habit" icon="plus" small onPress={() => router.push("/habit/new")} />
        </View>
      ) : null}

      {groups.map(({ cat, items }) => (
        <View key={cat.id}>
          <SectionLabel
            right={cat.private_by_default ? <Row gap={4}><Icon name="lock" size={12} color={c.muted} /><Txt v="caption" muted>Private</Txt></Row> : undefined}
          >
            {cat.name}
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
                  {detail(h)}
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
