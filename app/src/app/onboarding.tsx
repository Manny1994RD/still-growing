import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notificationsSupported, requestPermission } from "@/lib/notifications";
import { SUGGESTIONS } from "@/lib/suggestions";
import type { Category } from "@/lib/types";
import { Button, Check, Chip, ErrorText, Field, Header, Icon, Row, Screen, Spacer, Txt, Wrap } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { space, useLayout, useTheme } from "@/ui/theme";
import { TimeField } from "@/ui/TimeField";

// 1. Name + language  2. Areas  3. First habits  4. Reminder times
const STEPS = 4;

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const { c } = useTheme();
  const { wide } = useLayout();
  const { s, lang, category, suggestion, unit } = useI18n();
  const o = s.onboarding;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // "category:index"
  const [morning, setMorning] = useState("07:00");
  const [evening, setEvening] = useState("20:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories().then((r) => setCategories(r.categories.filter((x) => !x.custom)), () => {});
  }, []);

  const options = useMemo(
    () => areas.flatMap((a) => (SUGGESTIONS[a] ?? []).map((sg, i) => ({ key: `${a}:${i}`, sg }))),
    [areas],
  );

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  async function finish() {
    setError(null);
    setBusy(true);
    try {
      for (const key of picked) {
        const [cat, i] = key.split(":");
        const sg = SUGGESTIONS[cat!]![Number(i)]!;
        // Habits are created in the person's language.
        await api.createHabit({ ...sg, name: suggestion(sg.name), unit: unit(sg.unit), reminder_time: sg.reminder_time ?? null, share_name: false });
      }
      if (notificationsSupported) await requestPermission();
      await updateUser({ name: name.trim(), morning_time: morning, evening_time: evening, language: lang, onboarded: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canNext = [name.trim().length > 0, areas.length > 0, true, true][step];

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ width: "100%", maxWidth: wide ? 640 : undefined, alignSelf: "center" }}>
        <Row gap={6} style={{ marginBottom: space.xxl }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? c.ink : c.hairline }} />
          ))}
        </Row>

        {step === 0 && (
          <>
            <Header eyebrow={o.welcome} title={o.title0} />
            <Txt muted>{o.intro}</Txt>
            <Spacer h={space.xl} />
            <Field label={o.nameLabel} value={name} onChangeText={setName} placeholder={o.namePlaceholder} autoFocus />
            <Txt v="caption" muted style={{ marginBottom: space.sm }}>
              {s.common.language}
            </Txt>
            <LanguageToggle />
          </>
        )}

        {step === 1 && (
          <>
            <Header eyebrow={o.areasEyebrow} title={o.areasTitle} />
            <Txt muted>{o.areasIntro}</Txt>
            <Spacer h={space.xl} />
            <Wrap>
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={category(cat.id, cat.name)}
                  icon={cat.icon}
                  selected={areas.includes(cat.id)}
                  onPress={() => toggle(areas, setAreas, cat.id, 3)}
                />
              ))}
            </Wrap>
          </>
        )}

        {step === 2 && (
          <>
            <Header eyebrow={o.stepsEyebrow} title={o.stepsTitle} />
            <Txt muted>{o.stepsIntro}</Txt>
            <Spacer h={space.lg} />
            {options.map(({ key, sg }) => {
              const on = picked.includes(key);
              const cat = categories.find((x) => x.id === sg.category_id);
              return (
                <Pressable
                  key={key}
                  onPress={() => toggle(picked, setPicked, key, 3)}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md + 2, borderBottomWidth: 1, borderBottomColor: c.hairline }}
                >
                  <Check state={on ? "done" : "empty"} size={26} />
                  <View style={{ flex: 1 }}>
                    <Txt v="heading">{suggestion(sg.name)}</Txt>
                    <Txt v="small" muted>
                      {category(sg.category_id, cat?.name)} · {s.types[sg.type].label}
                      {sg.type === "count" || sg.type === "time" || sg.type === "weekly" ? ` · ${sg.target} ${unit(sg.unit)}` : ""}
                    </Txt>
                  </View>
                  <Icon name={cat?.icon ?? "circle"} size={18} color={c.muted} />
                </Pressable>
              );
            })}
          </>
        )}

        {step === 3 && (
          <>
            <Header eyebrow={o.rhythmEyebrow} title={o.rhythmTitle} />
            <Txt muted>{o.rhythmIntro}</Txt>
            <Spacer h={space.xl} />
            <Row gap={space.md} style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TimeField label={o.morning} value={morning} onChange={(v) => v && setMorning(v)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TimeField label={o.evening} value={evening} onChange={(v) => v && setEvening(v)} />
              </View>
            </Row>
            <Txt v="small" muted>
              {notificationsSupported ? o.permissionNote : o.webNote}
            </Txt>
          </>
        )}

        <Spacer h={space.xxl} />
        <ErrorText>{error}</ErrorText>
        {step < STEPS - 1 ? (
          <Button title={s.common.continue} onPress={() => setStep(step + 1)} disabled={!canNext} />
        ) : (
          <Button title={o.finish} onPress={finish} loading={busy} />
        )}
        {step > 0 ? (
          <>
            <Spacer h={space.sm} />
            <Button title={s.common.back} variant="ghost" onPress={() => setStep(step - 1)} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
