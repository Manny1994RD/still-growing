import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Loading } from "@/ui/components";
import { useTheme } from "@/ui/theme";
import { ToastProvider } from "@/ui/toast";

function RootNavigator() {
  const { user, loading } = useAuth();
  const { c, dark } = useTheme();
  if (loading) return <Loading />;

  const signedIn = !!user;
  const ready = signedIn && user.onboarded;

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !ready} redirectTo={signedIn ? "/" : "/welcome"}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={ready} redirectTo={signedIn ? "/onboarding" : "/welcome"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="habit/new" options={{ presentation: "modal" }} />
          <Stack.Screen name="habit/[id]" options={{ presentation: "modal" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
