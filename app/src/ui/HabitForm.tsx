import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { isValidTime } from "@/lib/date";
import { SUGGESTIONS } from "@/lib/suggestions";
import type { Category, Habit, HabitInput, HabitType } from "@/lib/types";
import { Button, Chip, ErrorText, Field, Header, IconButton, Row, Screen, SectionLabel, Spacer, Txt, Wrap } from "./components";
import { space, useTheme } from "./theme";

const TYPES: HabitType[] = ["do", "count", "time", "weekly", "refrain"];

export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { c } = useTheme();
  const { s, category, suggestion, unit: unitName } = useI18n();
  const f = s.form;
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

  function applySuggestion(sg: (typeof SUGGESTIONS)[string][number]) {
    setName(suggestion(sg.name));
    setCategoryId(sg.category_id);
    setType(sg.type);
    setTarget(String(sg.target));
    setUnit(unitName(sg.unit));
    setDays(sg.days_mask);
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      const { category: created } = await api.createCategory(newCat.trim(), "star");
      setCategories((cs) => [...cs, created]);
      setCategoryId(created.id);
      setNewCat("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setError(null);
    const t = Number(target);
    if (!name.trim()) return setError(f.errName);
    if (needsTarget && (!Number.isInteger(t) || t < 1)) return setError(f.errGoal);
    if (reminder && !isValidTime(reminder)) return setError(f.errReminder);
    const input: HabitInput = {
      name: name.trim(),
      category_id: categoryId,
      type,
      target: needsTarget ? t : 1,
      unit: needsTarget ? unit.trim() || f.defaultUnit(type) : "",
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
    const title = kind === "delete" ? f.confirmDeleteTitle : f.confirmArchiveTitle;
    const msg = kind === "delete" ? f.confirmDelete : f.confirmArchive;
    const ok =
      Platform.OS === "web"
        ? (globalThis.confirm?.(`${title}\n\n${msg}`) ?? false)
        : await new Promise<boolean>((resolve) =>
            Alert.alert(title, msg, [
              { text: s.common.cancel, style: "cancel", onPress: () => resolve(false) },
              { text: kind === "delete" ? s.common.delete : f.archive, style: "destructive", onPress: () => resolve(true) },
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
        <IconButton name="x" label={s.common.close} onPress={close} />
      </Row>
      <Header eyebrow={habit ? f.editEyebrow : f.newEyebrow} title={habit ? habit.name : f.newTitle} />

      <Field label={f.name} value={name} onChangeText={setName} placeholder={f.namePh} autoFocus={!habit} />

      {suggestions.length ? (
        <View style={{ marginTop: -space.sm, marginBottom: space.md }}>
          <Txt v="caption" muted style={{ marginBottom: space.sm }}>
            {f.ideas}
          </Txt>
          <Wrap>
            {suggestions.map((sg) => (
              <Chip key={sg.name} label={suggestion(sg.name)} icon="plus" onPress={() => applySuggestion(sg)} />
            ))}
          </Wrap>
        </View>
      ) : null}

      <SectionLabel>{f.area}</SectionLabel>
      <Wrap>
        {categories.map((cat) => (
          <Chip key={cat.id} label={category(cat.id, cat.name)} icon={cat.icon} selected={cat.id === categoryId} onPress={() => setCategoryId(cat.id)} />
        ))}
      </Wrap>
      <Row style={{ marginTop: space.md }} gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Field value={newCat} onChangeText={setNewCat} placeholder={f.newArea} onSubmitEditing={addCategory} style={{ minHeight: 44 }} />
        </View>
        <View style={{ marginBottom: space.lg }}>
          <Button title={f.add} small variant="secondary" onPress={addCategory} disabled={!newCat.trim()} />
        </View>
      </Row>

      <SectionLabel>{f.track}</SectionLabel>
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
                {s.types[tp].label}
              </Txt>
              <Txt v="small" muted>
                {s.types[tp].hint}
              </Txt>
            </View>
          </Pressable>
        );
      })}

      {needsTarget ? (
        <Row gap={space.md} style={{ marginTop: space.xl }}>
          <View style={{ flex: 1 }}>
            <Field label={type === "weekly" ? f.perWeek : f.dailyGoal} value={target} onChangeText={setTarget} keyboardType="number-pad" maxLength={4} />
          </View>
          {type !== "weekly" ? (
            <View style={{ flex: 1 }}>
              <Field label={f.unit} value={unit} onChangeText={setUnit} placeholder={f.unitPh(type)} maxLength={24} />
            </View>
          ) : null}
        </Row>
      ) : null}

      {type !== "weekly" ? (
        <>
          <SectionLabel>{f.days}</SectionLabel>
          <Row style={{ justifyContent: "space-between" }}>
            {s.schedule.letters.map((d, i) => {
              const on = (days & (1 << i)) !== 0;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityLabel={s.schedule.short[i]}
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

      <SectionLabel>{f.reminder}</SectionLabel>
      <Field value={reminder} onChangeText={setReminder} placeholder={f.reminderPh} maxLength={5} hint={f.reminderHint} />

      <Spacer h={space.lg} />
      <ErrorText>{error}</ErrorText>
      <Button title={habit ? s.common.save : f.create} onPress={save} loading={busy} />
      {habit ? (
        <>
          <Spacer h={space.sm} />
          <Button title={f.archive} variant="ghost" onPress={() => remove("archive")} />
          <Button title={s.common.delete} variant="danger" onPress={() => remove("delete")} />
        </>
      ) : null}
    </Screen>
  );
}
