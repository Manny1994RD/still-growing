import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isValidTime } from "@/lib/date";
import { notificationsSupported, requestPermission } from "@/lib/notifications";
import { SUGGESTIONS, TYPE_LABELS } from "@/lib/suggestions";
import type { Category } from "@/lib/types";
import { Button, Check, Chip, ErrorText, Field, Header, Icon, Row, Screen, Spacer, Txt, Verse, Wrap } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";

const STEPS = 5;

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? "");
  const [identity, setIdentity] = useState("");
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
    () => areas.flatMap((a) => (SUGGESTIONS[a] ?? []).map((s, i) => ({ key: `${a}:${i}`, s }))),
    [areas],
  );

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  async function finish() {
    setError(null);
    if (!isValidTime(morning) || !isValidTime(evening)) return setError("Use 24-hour times like 07:00 and 20:00.");
    setBusy(true);
    try {
      for (const key of picked) {
        const [cat, i] = key.split(":");
        const s = SUGGESTIONS[cat!]![Number(i)]!;
        await api.createHabit({ ...s, reminder_time: s.reminder_time ?? null, share_name: false });
      }
      if (notificationsSupported) await requestPermission();
      await updateUser({ name: name.trim(), identity_statement: identity.trim(), morning_time: morning, evening_time: evening, onboarded: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canNext = [name.trim().length > 0, true, areas.length > 0, true, true][step];

  return (
    <Screen edges={["top", "bottom"]}>
      <Row gap={6} style={{ marginBottom: space.xxl }}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? c.ink : c.hairline }} />
        ))}
      </Row>

      {step === 0 && (
        <>
          <Header eyebrow="Welcome" title="God isn't finished with you." />
          <Txt muted>Still Growing helps you build habits that shape who you're becoming, one faithful step at a time.</Txt>
          <Spacer h={space.xl} />
          <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="First name" autoFocus />
        </>
      )}

      {step === 1 && (
        <>
          <Header eyebrow="Who you're becoming" title="In Christ, I'm becoming someone who…" />
          <Field
            value={identity}
            onChangeText={setIdentity}
            placeholder="…shows up with faith every day"
            multiline
            style={{ minHeight: 110 }}
            hint="You can change this anytime. It appears on your Today screen as a quiet reminder."
          />
          <Spacer h={space.lg} />
          <Verse text="If anyone is in Christ, he is a new creation." refText="2 Corinthians 5:17" />
        </>
      )}

      {step === 2 && (
        <>
          <Header eyebrow="Areas" title="Where do you want to grow?" />
          <Txt muted>Pick up to 3. God cares about all of you: spirit, body, mind and relationships.</Txt>
          <Spacer h={space.xl} />
          <Wrap>
            {categories.map((cat) => (
              <Chip key={cat.id} label={cat.name} icon={cat.icon} selected={areas.includes(cat.id)} onPress={() => toggle(areas, setAreas, cat.id, 3)} />
            ))}
          </Wrap>
        </>
      )}

      {step === 3 && (
        <>
          <Header eyebrow="First steps" title="Pick up to 3 habits" />
          <Txt muted>Start small. You can add, change or create your own later.</Txt>
          <Spacer h={space.lg} />
          {options.map(({ key, s }) => {
            const on = picked.includes(key);
            const cat = categories.find((x) => x.id === s.category_id);
            return (
              <Pressable
                key={key}
                onPress={() => toggle(picked, setPicked, key, 3)}
                style={{ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.md + 2, borderBottomWidth: 1, borderBottomColor: c.hairline }}
              >
                <Check state={on ? "done" : "empty"} size={26} />
                <View style={{ flex: 1 }}>
                  <Txt v="heading">{s.name}</Txt>
                  <Txt v="small" muted>
                    {cat?.name} · {TYPE_LABELS[s.type].label}
                    {s.type === "count" || s.type === "time" || s.type === "weekly" ? ` · ${s.target} ${s.unit}` : ""}
                  </Txt>
                </View>
                <Icon name={cat?.icon ?? "circle"} size={18} color={c.muted} />
              </Pressable>
            );
          })}
        </>
      )}

      {step === 4 && (
        <>
          <Header eyebrow="Rhythm" title="When should we encourage you?" />
          <Txt muted>A short word from God's promises each morning, and a quiet check-in each evening.</Txt>
          <Spacer h={space.xl} />
          <Row gap={space.md}>
            <View style={{ flex: 1 }}>
              <Field label="Morning" value={morning} onChangeText={setMorning} placeholder="07:00" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Evening" value={evening} onChangeText={setEvening} placeholder="20:00" maxLength={5} />
            </View>
          </Row>
          {notificationsSupported ? (
            <Txt v="small" muted>
              Next, we'll ask permission to send these. Encouragement only, never spam.
            </Txt>
          ) : (
            <Txt v="small" muted>
              Reminders arrive on the Android and iPhone apps.
            </Txt>
          )}
        </>
      )}

      <Spacer h={space.xxl} />
      <ErrorText>{error}</ErrorText>
      {step < STEPS - 1 ? (
        <Button title={step === 1 && !identity.trim() ? "Skip for now" : "Continue"} onPress={() => setStep(step + 1)} disabled={!canNext} />
      ) : (
        <Button title="Take the first step" onPress={finish} loading={busy} />
      )}
      {step > 0 ? (
        <>
          <Spacer h={space.sm} />
          <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} />
        </>
      ) : null}
    </Screen>
  );
}
