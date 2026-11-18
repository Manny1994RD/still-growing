import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Header, IconButton, Screen, Spacer } from "@/ui/components";
import { ServerPicker } from "@/ui/ServerPicker";
import { space } from "@/ui/theme";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
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
      <IconButton name="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />
      <Spacer h={space.xl} />
      <Header title="Welcome back" eyebrow="Sign in" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="••••••••" onSubmitEditing={submit} />
      <ErrorText>{error}</ErrorText>
      <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
      <Spacer h={space.md} />
      <Button title="Create an account" variant="ghost" onPress={() => router.replace("/sign-up")} />
      <Spacer h={space.lg} />
      <ServerPicker />
    </Screen>
  );
}
