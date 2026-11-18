import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Header, IconButton, Screen, Spacer, Txt } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { ServerPicker } from "@/ui/ServerPicker";
import { space } from "@/ui/theme";

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { s } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) return setError(s.auth.passwordShort);
    setBusy(true);
    try {
      await signUp(email, password, name);
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
      <Header title={s.auth.letsBegin} eyebrow={s.auth.createAccount} />
      <Field label={s.auth.firstName} value={name} onChangeText={setName} autoComplete="given-name" placeholder="Manny" />
      <Field label={s.auth.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label={s.auth.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={s.auth.passwordHint} onSubmitEditing={submit} />
      <Txt v="caption" muted style={{ marginBottom: space.sm }}>
        {s.common.language}
      </Txt>
      <LanguageToggle />
      <Spacer h={space.xl} />
      <ErrorText>{error}</ErrorText>
      <Button title={s.auth.createAccount} onPress={submit} loading={busy} disabled={!email || !password || !name.trim()} />
      <Spacer h={space.lg} />
      <Txt v="small" muted center>
        {s.auth.private}
      </Txt>
      <Spacer h={space.lg} />
      <ServerPicker />
    </Screen>
  );
}
