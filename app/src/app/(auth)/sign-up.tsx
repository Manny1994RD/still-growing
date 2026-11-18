import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Header, IconButton, Screen, Spacer, Txt } from "@/ui/components";
import { space } from "@/ui/theme";

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
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
      <IconButton name="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      <Spacer h={space.xl} />
      <Header title="Let's begin" eyebrow="Create account" />
      <Field label="First name" value={name} onChangeText={setName} autoComplete="given-name" placeholder="Manny" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" onSubmitEditing={submit} />
      <ErrorText>{error}</ErrorText>
      <Button title="Create account" onPress={submit} loading={busy} disabled={!email || !password || !name.trim()} />
      <Spacer h={space.lg} />
      <Txt v="small" muted center>
        Your habits and reflections are private to you.
      </Txt>
    </Screen>
  );
}
