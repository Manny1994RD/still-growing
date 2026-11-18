import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { api, session } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Header, IconButton, Screen, Spacer, Txt } from "@/ui/components";
import { space } from "@/ui/theme";

/** Two steps: get a 6-digit code by email, then choose a new password. */
export default function Forgot() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { s } = useI18n();
  const t = s.v5;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    if (password.length < 8) return setError(s.auth.passwordShort);
    setBusy(true);
    try {
      const r = await api.resetPassword(email.trim(), code.trim(), password);
      await session.set(r.token);
      setUser(r.user);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <IconButton name="arrow-left" label={s.auth.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))} />
      <Spacer h={space.xl} />
      <Header eyebrow={s.auth.signIn} title={t.resetTitle} />
      {!sent ? (
        <>
          <Txt muted>{t.resetIntro}</Txt>
          <Spacer h={space.lg} />
          <Field label={s.auth.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={send} />
          <ErrorText>{error}</ErrorText>
          <Button title={t.sendCode} onPress={send} loading={busy} disabled={!email.includes("@")} />
        </>
      ) : (
        <>
          <Txt muted>{t.codeSent}</Txt>
          <Spacer h={space.lg} />
          <Field label={t.code} value={code} onChangeText={(x) => setCode(x.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          <Field label={t.newPassword} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder={s.auth.passwordHint} />
          <ErrorText>{error}</ErrorText>
          <Button title={t.resetButton} onPress={reset} loading={busy} disabled={code.length !== 6 || !password} />
          <Spacer h={space.md} />
          <Button title={t.sendCode} variant="ghost" onPress={send} />
        </>
      )}
      <Spacer h={space.xl} />
      <Txt v="small" muted center>
        {t.resetHelp}
      </Txt>
    </Screen>
  );
}
