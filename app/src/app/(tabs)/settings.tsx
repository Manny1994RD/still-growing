import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useI18n } from "@/i18n";
import { api, server } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isValidTime } from "@/lib/date";
import { notificationsSupported, requestPermission } from "@/lib/notifications";
import type { Tone } from "@/lib/types";
import { Button, ErrorText, Field, Header, Row, Screen, SectionLabel, Segmented, Spacer, Txt } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { space } from "@/ui/theme";
import { useToast } from "@/ui/toast";

function confirm(title: string, message: string, action: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function Settings() {
  const { user, updateUser, signOut } = useAuth();
  const toast = useToast();
  const { s } = useI18n();
  const t = s.settings;
  const [name, setName] = useState(user?.name ?? "");
  const [identity, setIdentity] = useState(user?.identity_statement ?? "");
  const [vision, setVision] = useState(user?.vision ?? "");
  const [tone, setTone] = useState<Tone>(user?.tone ?? "gentle");
  const [morning, setMorning] = useState(user?.morning_time ?? "07:00");
  const [evening, setEvening] = useState(user?.evening_time ?? "20:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    if (!isValidTime(morning) || !isValidTime(evening)) return setError(s.onboarding.timeError);
    setBusy(true);
    try {
      await updateUser({ name: name.trim(), identity_statement: identity.trim(), vision: vision.trim(), tone, morning_time: morning, evening_time: evening });
      toast({ text: s.common.saved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!(await confirm(t.deleteTitle, t.deleteBody, s.common.delete, s.common.cancel))) return;
    try {
      await api.deleteMe();
      await signOut();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Header eyebrow={user?.email} title={t.title} />

      <SectionLabel>{s.common.language}</SectionLabel>
      <LanguageToggle />

      <SectionLabel>{t.becoming}</SectionLabel>
      <Field label={t.name} value={name} onChangeText={setName} />
      <Field label={t.identity} value={identity} onChangeText={setIdentity} multiline style={{ minHeight: 80 }} />
      <Field label={t.vision} value={vision} onChangeText={setVision} multiline style={{ minHeight: 80 }} placeholder={t.visionPh} />

      <SectionLabel>{t.encouragement}</SectionLabel>
      <Txt v="caption" muted style={{ marginBottom: space.sm }}>
        {t.tone}
      </Txt>
      <Segmented<Tone>
        value={tone}
        onChange={setTone}
        options={[
          { value: "gentle", label: t.gentle },
          { value: "scripture", label: t.scripture },
          { value: "coach", label: t.coach },
        ]}
      />
      <Spacer h={space.lg} />
      <Row gap={space.md} style={{ alignItems: "flex-end" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Field label={t.morning} value={morning} onChangeText={setMorning} maxLength={5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Field label={t.evening} value={evening} onChangeText={setEvening} maxLength={5} />
        </View>
      </Row>
      {notificationsSupported ? (
        <Button
          title={t.allowNotifications}
          variant="secondary"
          small
          icon="bell"
          onPress={async () => toast({ text: (await requestPermission()) ? t.notificationsOn : t.notificationsOff })}
        />
      ) : (
        <Txt v="small" muted>
          {s.onboarding.webNote}
        </Txt>
      )}

      <Spacer h={space.xl} />
      <ErrorText>{error}</ErrorText>
      <Button title={s.common.save} onPress={save} loading={busy} />

      <SectionLabel>{t.account}</SectionLabel>
      <Button title={t.signOut} variant="secondary" onPress={signOut} />
      <Spacer h={space.sm} />
      <Button title={t.deleteAccount} variant="danger" onPress={deleteAccount} />
      <Spacer h={space.xl} />
      <Txt v="small" muted center>
        Still Growing 0.3 · {server.url}
      </Txt>
    </Screen>
  );
}
