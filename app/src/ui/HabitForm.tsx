import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Alert } from "react-native";
import { api } from "@/lib/api";
import { isValidTime, WEEKDAYS } from "@/lib/date";
import { SUGGESTIONS, TYPE_LABELS } from "@/lib/suggestions";
import type { Category, Habit, HabitInput, HabitType } from "@/lib/types";
import { Button, Chip, ErrorText, Field, Header, IconButton, Row, Screen, SectionLabel, Spacer, Txt, Wrap } from "./components";
import { space, useTheme } from "./theme";

const TYPES: HabitType[] = ["do", "count", "time", "weekly", "refrain"];

export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { c } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(habit?.name ?? "");
  const [categoryId, setCategoryId] = useState(habit?.category_id ?? "faith");
  const [type, setType] = useState<HabitType>(habit?.type ?? "do");
  const [target, setTarget] = useState(String(habit?.target ?? 1));
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [days, setDays] = useState(habit?.days_mask ?? 127);
  const [reminder, setReminder] = useState(habit?.reminder_time ?? "");
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories().then((r) => setCategories(r.categories), (e) => setError(e.message));
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/habits"));
  const needsTarget = type === "count" || type === "time" || type === "weekly";

  function applySuggestion(s: (typeof SUGGESTIONS)[string][number]) {
    setName(s.name);
    setCategoryId(s.category_id);
    setType(s.type);
    setTarget(String(s.target));
    setUnit(s.unit);
    setDays(s.days_mask);
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      const { category } = await api.createCategory(newCat.trim(), "star");
      setCategories((cs) => [...cs, category]);
      setCategoryId(category.id);
      setNewCat("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setError(null);
    const t = Number(target);
    if (!name.trim()) return setError("Give your habit a name.");
    if (needsTarget && (!Number.isInteger(t) || t < 1)) return setError("Goal must be a whole number of 1 or more.");
    if (reminder && !isValidTime(reminder)) return setError("Reminder must be a 24-hour time like 07:30.");
    const input: HabitInput = {
      name: name.trim(),
      category_id: categoryId,
      type,
      target: needsTarget ? t : 1,
      unit: needsTarget ? unit.trim() || (type === "time" ? "min" : type === "weekly" ? "times" : "") : "",
      days_mask: type === "weekly" ? 127 : days,
      reminder_time: reminder || null,
      share_name: habit?.share_name ?? false,
    };
    setBusy(true);
    try {
      if (habit) await api.updateHabit(habit.id, input);
      else await api.createHabit(input);
      close();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove(kind: "archive" | "delete") {
    if (!habit) return;
    const msg = kind === "delete" ? "This deletes the habit and its history permanently." : "It will be hidden but its history is kept.";
    const ok =
      Platform.OS === "web"
        ? globalThis.confirm?.(msg) ?? false
        : await new Promise<boolean>((resolve) =>
            Alert.alert(kind === "delete" ? "Delete habit?" : "Archive habit?", msg, [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: kind === "delete" ? "Delete" : "Archive", style: "destructive", onPress: () => resolve(true) },
            ]),
          );
    if (!ok) return;
    try {
      if (kind === "delete") await api.deleteHabit(habit.id);
      else await api.updateHabit(habit.id, { archived: true });
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const suggestions = !habit && !name ? (SUGGESTIONS[categoryId] ?? []) : [];

  return (
    <Screen edges={Platform.OS === "ios" ? [] : ["top"]}>
      <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
        <IconButton name="x" label="Close" onPress={close} />
      </Row>
      <Header eyebrow={habit ? "Edit habit" : "New habit"} title={habit ? habit.name : "A new step"} />

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Read the Bible" autoFocus={!habit} />

      {suggestions.length ? (
        <View style={{ marginTop: -space.sm, marginBottom: space.md }}>
          <Txt v="caption" muted style={{ marginBottom: space.sm }}>
            Ideas
          </Txt>
          <Wrap>
            {suggestions.map((s) => (
              <Chip key={s.name} label={s.name} icon="plus" onPress={() => applySuggestion(s)} />
            ))}
          </Wrap>
        </View>
      ) : null}

      <SectionLabel>Area of life</SectionLabel>
      <Wrap>
        {categories.map((cat) => (
          <Chip key={cat.id} label={cat.name} icon={cat.icon} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
        ))}
      </Wrap>
      <Row style={{ marginTop: space.md }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Field value={newCat} onChangeText={setNewCat} placeholder="Create your own area" onSubmitEditing={addCategory} style={{ minHeight: 44 }} />
        </View>
        <View style={{ marginBottom: space.lg }}>
          <Button title="Add" small variant="secondary" onPress={addCategory} disabled={!newCat.trim()} />
        </View>
      </Row>

      <SectionLabel>How to track it</SectionLabel>
      {TYPES.map((tp) => {
        const on = tp === type;
        return (
          <Pressable
            key={tp}
            onPress={() => setType(tp)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 1.5, borderColor: on ? c.ink : c.muted }} />
            <View style={{ flex: 1 }}>
              <Txt v="heading" style={{ fontSize: 15 }}>
                {TYPE_LABELS[tp].label}
              </Txt>
              <Txt v="small" muted>
                {TYPE_LABELS[tp].hint}
              </Txt>
            </View>
          </Pressable>
        );
      })}

      {needsTarget ? (
        <Row gap={space.md} style={{ marginTop: space.xl }}>
          <View style={{ flex: 1 }}>
            <Field label={type === "weekly" ? "Times per week" : "Daily goal"} value={target} onChangeText={setTarget} keyboardType="number-pad" maxLength={4} />
          </View>
          {type !== "weekly" ? (
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={unit} onChangeText={setUnit} placeholder={type === "time" ? "min" : "glasses"} maxLength={24} />
            </View>
          ) : null}
        </Row>
      ) : null}

      {type !== "weekly" ? (
        <>
          <SectionLabel>Which days</SectionLabel>
          <Row style={{ justifyContent: "space-between" }}>
            {WEEKDAYS.map((d, i) => {
              const on = (days & (1 << i)) !== 0;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    const next = days ^ (1 << i);
                    if (next) setDays(next);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? c.ink : "transparent",
                    borderWidth: 1,
                    borderColor: on ? c.ink : c.hairline,
                  }}
                >
                  <Txt v="small" style={{ color: on ? c.invertInk : c.ink, fontWeight: "600" }}>
                    {d}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>
        </>
      ) : null}

      <SectionLabel>Reminder</SectionLabel>
      <Field value={reminder} onChangeText={setReminder} placeholder="Optional, e.g. 07:30" maxLength={5} hint="A short word of encouragement at this time." />

      <Spacer h={space.lg} />
      <ErrorText>{error}</ErrorText>
      <Button title={habit ? "Save changes" : "Create habit"} onPress={save} loading={busy} />
      {habit ? (
        <>
          <Spacer h={space.sm} />
          <Button title="Archive" variant="ghost" onPress={() => remove("archive")} />
          <Button title="Delete" variant="danger" onPress={() => remove("delete")} />
        </>
      ) : null}
    </Screen>
  );
}
