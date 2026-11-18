import { useState } from "react";
import { Alert, Platform } from "react-native";
import { api, server } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isValidTime } from "@/lib/date";
import { notificationsSupported, requestPermission } from "@/lib/notifications";
import type { Tone } from "@/lib/types";
import { Button, ErrorText, Field, Header, Row, Screen, SectionLabel, Segmented, Spacer, Txt } from "@/ui/components";
import { space } from "@/ui/theme";
import { useToast } from "@/ui/toast";

function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function Settings() {
  const { user, updateUser, signOut } = useAuth();
  const toast = useToast();
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
    if (!isValidTime(morning) || !isValidTime(evening)) return setError("Use 24-hour times like 07:00 and 20:00.");
    setBusy(true);
    try {
      await updateUser({ name: name.trim(), identity_statement: identity.trim(), vision: vision.trim(), tone, morning_time: morning, evening_time: evening });
      toast({ text: "Saved." });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!(await confirm("Delete account?", "This permanently deletes your account, habits and reflections. It can't be undone.", "Delete"))) return;
    try {
      await api.deleteMe();
      await signOut();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Header eyebrow={user?.email} title="You" />

      <SectionLabel>Who you're becoming</SectionLabel>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="In Christ, I'm becoming someone who…" value={identity} onChangeText={setIdentity} multiline style={{ minHeight: 80 }} />
      <Field label="The life God is calling me to" value={vision} onChangeText={setVision} multiline style={{ minHeight: 80 }} placeholder="One sentence is enough" />

      <SectionLabel>Encouragement</SectionLabel>
      <Txt v="caption" muted style={{ marginBottom: space.sm }}>
        Tone
      </Txt>
      <Segmented<Tone>
        value={tone}
        onChange={setTone}
        options={[
          { value: "gentle", label: "Gentle" },
          { value: "scripture", label: "Scripture" },
          { value: "coach", label: "Coach" },
        ]}
      />
      <Spacer h={space.lg} />
      <Row gap={space.md}>
        <Field label="Morning word" value={morning} onChangeText={setMorning} maxLength={5} style={{ minWidth: 140 }} />
        <Field label="Evening check-in" value={evening} onChangeText={setEvening} maxLength={5} style={{ minWidth: 140 }} />
      </Row>
      {notificationsSupported ? (
        <Button
          title="Allow notifications"
          variant="secondary"
          small
          icon="bell"
          onPress={async () => toast({ text: (await requestPermission()) ? "Notifications are on." : "Notifications are off. You can turn them on in system settings." })}
        />
      ) : (
        <Txt v="small" muted>
          Reminders arrive on the Android and iPhone apps.
        </Txt>
      )}

      <Spacer h={space.xl} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save changes" onPress={save} loading={busy} />

      <SectionLabel>Account</SectionLabel>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <Spacer h={space.sm} />
      <Button title="Delete account" variant="danger" onPress={deleteAccount} />
      <Spacer h={space.xl} />
      <Txt v="small" muted center>
        Still Growing 0.2 · {server.url}
      </Txt>
    </Screen>
  );
}
