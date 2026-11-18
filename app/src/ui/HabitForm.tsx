import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { SUGGESTIONS } from "@/lib/suggestions";
import type { Category, Habit, HabitInput, HabitType, PartOfDay } from "@/lib/types";
import { Button, Chip, ErrorText, Field, Header, Icon, IconButton, Row, Screen, SectionLabel, Segmented, Spacer, Txt, Wrap } from "./components";
import { radius, space, useTheme } from "./theme";
import { TimeField } from "./TimeField";

const TYPES: HabitType[] = ["do", "count", "time", "weekly", "refrain"];
const EMOJIS = ["🙏", "📖", "✝️", "⛪", "🎵", "💛", "💧", "🥗", "🍎", "💊", "🚶", "🏃", "💪", "🧘", "😴", "🌙", "📵", "🚭", "🥤", "🧠", "📚", "✍️", "🙌", "👨‍👩‍👧", "📞", "💰", "🧹", "🌱", "☀️", "⭐"];
// Muted colors that sit quietly next to the black-and-white design.
const COLORS = ["#2F6B4F", "#3B5BA5", "#8C5E3C", "#7A4E8C", "#B0533C", "#2E7D8C", "#A08A2E", "#5E5E5E"];
const PARTS: PartOfDay[] = ["any", "morning", "afternoon", "evening"];

export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { c } = useTheme();
  const { s, category, suggestion, unit: unitName } = useI18n();
  const f = s.form;
  const v = s.v5;
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(habit?.name ?? "");
  const [categoryId, setCategoryId] = useState(habit?.category_id ?? "faith");
  const [type, setType] = useState<HabitType>(habit?.type ?? "do");
  const [target, setTarget] = useState(String(habit?.target ?? 1));
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [days, setDays] = useState(habit?.days_mask ?? 127);
  const [reminders, setReminders] = useState<string[]>(habit?.reminders?.length ? habit.reminders : habit?.reminder_time ? [habit.reminder_time] : []);
  const [emoji, setEmoji] = useState(habit?.emoji ?? "");
  const [color, setColor] = useState(habit?.color ?? "");
  const [why, setWhy] = useState(habit?.why ?? "");
  const [part, setPart] = useState<PartOfDay>(habit?.part_of_day ?? "any");
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
    const input: HabitInput = {
      name: name.trim(),
      category_id: categoryId,
      type,
      target: needsTarget ? t : 1,
      unit: needsTarget ? unit.trim() || f.defaultUnit(type) : "",
      days_mask: type === "weekly" ? 127 : days,
      reminder_time: reminders[0] ?? null,
      reminders,
      share_name: habit?.share_name ?? false,
      emoji,
      color,
      why: why.trim(),
      part_of_day: part,
    };
    setBusy(true);
    try {
      if (habit) await api.updateHabit(habit.id, input as Partial<Habit>);
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

      <Row gap={space.md} style={{ alignItems: "flex-start" }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: color ? 2 : 0,
            borderColor: color || "transparent",
          }}
        >
          {emoji ? <Txt style={{ fontSize: 26, lineHeight: 32 }}>{emoji}</Txt> : <Icon name="smile" color={c.muted} />}
        </View>
        <View style={{ flex: 1 }}>
          <Field value={name} onChangeText={setName} placeholder={f.namePh} autoFocus={!habit} />
        </View>
      </Row>

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

      <SectionLabel>{v.icon}</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            accessibilityRole="button"
            accessibilityState={{ selected: emoji === e }}
            onPress={() => setEmoji(emoji === e ? "" : e)}
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: emoji === e ? c.ink : c.surface,
            }}
          >
            <Txt style={{ fontSize: 20, lineHeight: 26 }}>{e}</Txt>
          </Pressable>
        ))}
      </View>

      <SectionLabel>{v.color}</SectionLabel>
      <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
        <Pressable
          onPress={() => setColor("")}
          accessibilityLabel={v.noColor}
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: color === "" ? 3 : 1, borderColor: c.ink, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="slash" size={14} color={c.muted} />
        </Pressable>
        {COLORS.map((col) => (
          <Pressable
            key={col}
            onPress={() => setColor(col)}
            accessibilityLabel={col}
            accessibilityState={{ selected: color === col }}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, borderWidth: color === col ? 3 : 0, borderColor: c.ink }}
          />
        ))}
      </Row>

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
                {s.types[tp].hint} · <Txt v="small" style={{ fontStyle: "italic" }} muted>{v.examples[tp]}</Txt>
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

      <SectionLabel>{v.timeOfDay}</SectionLabel>
      <Segmented<PartOfDay> value={part} onChange={setPart} options={PARTS.map((p) => ({ value: p, label: v.partOfDay[p]! }))} />

      <SectionLabel>{v.reminders}</SectionLabel>
      {reminders.map((r, i) => (
        <Row key={`${r}-${i}`} gap={space.sm} style={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <TimeField
              value={r}
              onChange={(nv) => setReminders((list) => (nv ? list.map((x, j) => (j === i ? nv : x)) : list.filter((_, j) => j !== i)))}
            />
          </View>
          <View style={{ paddingTop: 4 }}>
            <IconButton name="x" label={s.time.remove} onPress={() => setReminders((list) => list.filter((_, j) => j !== i))} />
          </View>
        </Row>
      ))}
      <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
        {reminders.length < 12 ? (
          <Button title={v.addReminder} small variant="secondary" icon="bell" onPress={() => setReminders((list) => [...list, list.length ? "12:00" : "08:00"])} />
        ) : null}
        {type === "count" ? (
          <Button
            title={v.everyTwoHours}
            small
            variant="ghost"
            icon="repeat"
            onPress={() => setReminders(["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"])}
          />
        ) : null}
      </Row>
      <Txt v="small" muted style={{ marginTop: space.sm }}>
        {f.reminderHint}
      </Txt>

      <SectionLabel>{v.why}</SectionLabel>
      <Field value={why} onChangeText={setWhy} placeholder={v.whyPh} multiline maxLength={200} style={{ minHeight: 70 }} hint={v.whyHint} />

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
