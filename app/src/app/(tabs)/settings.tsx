import { useState } from "react";
import { Alert, Platform, Switch, View } from "react-native";
import { useI18n } from "@/i18n";
import { api, server } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAppLock } from "@/lib/lock";
import { notificationsSupported, requestPermission } from "@/lib/notifications";
import { Button, ErrorText, Field, Header, Row, Screen, SectionLabel, Spacer, Txt } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { space } from "@/ui/theme";
import { TimeField } from "@/ui/TimeField";
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
  const lock = useAppLock();
  const [name, setName] = useState(user?.name ?? "");
  const [morning, setMorning] = useState(user?.morning_time ?? "07:00");
  const [evening, setEvening] = useState(user?.evening_time ?? "20:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await updateUser({ name: name.trim(), morning_time: morning, evening_time: evening });
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

      <SectionLabel>{t.profile}</SectionLabel>
      <Field label={t.name} value={name} onChangeText={setName} />

      <SectionLabel>{t.encouragement}</SectionLabel>
      <Row gap={space.md} style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TimeField label={t.morning} value={morning} onChange={(v) => v && setMorning(v)} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TimeField label={t.evening} value={evening} onChange={(v) => v && setEvening(v)} />
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

      {Platform.OS !== "web" ? (
        <>
          <SectionLabel>{s.v5.privacy}</SectionLabel>
          <Row gap={space.lg}>
            <View style={{ flex: 1 }}>
              <Txt v="heading" style={{ fontSize: 15 }}>
                {s.v5.lock}
              </Txt>
              <Txt v="small" muted>
                {lock.available ? s.v5.lockHint : s.v5.lockUnavailable}
              </Txt>
            </View>
            <Switch value={lock.enabled} disabled={!lock.available} onValueChange={(on) => void lock.setEnabled(on)} />
          </Row>
        </>
      ) : null}

      <SectionLabel>{t.account}</SectionLabel>
      <Button title={t.signOut} variant="secondary" onPress={signOut} />
      <Spacer h={space.sm} />
      <Button title={t.deleteAccount} variant="danger" onPress={deleteAccount} />
      <Spacer h={space.xl} />
      <Txt v="small" muted center>
        Still Growing 0.5 · {server.url}
      </Txt>
    </Screen>
  );
}
