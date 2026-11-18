import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Header, IconButton, Screen, Spacer } from "@/ui/components";
import { ServerPicker } from "@/ui/ServerPicker";
import { space } from "@/ui/theme";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { s } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <IconButton name="arrow-left" label={s.auth.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      <Spacer h={space.xl} />
      <Header title={s.auth.welcomeBack} eyebrow={s.auth.signIn} />
      <Field label={s.auth.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label={s.auth.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="••••••••" onSubmitEditing={submit} />
      <ErrorText>{error}</ErrorText>
      <Button title={s.auth.signIn} onPress={submit} loading={busy} disabled={!email || !password} />
      <Spacer h={space.sm} />
      <Button title={s.v5.forgot} variant="ghost" small onPress={() => router.push("/forgot")} />
      <Spacer h={space.md} />
      <Button title={s.auth.createAnAccount} variant="ghost" onPress={() => router.replace("/sign-up")} />
      <Spacer h={space.lg} />
      <ServerPicker />
    </Screen>
  );
}
