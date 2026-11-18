import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { scheduleWeek } from "@/lib/notifications";
import { useI18n } from "@/i18n";
import { Icon } from "@/ui/components";
import { useTheme } from "@/ui/theme";

/** Re-schedule the week's encouragement whenever the app comes to the foreground. */
function useReminderSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const sync = async () => {
      try {
        const [{ habits }, { messages }] = await Promise.all([api.habits(), api.content()]);
        await scheduleWeek(user, habits, messages);
      } catch {}
    };
    void sync();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void sync());
    return () => sub.remove();
  }, [user]);
}

export default function TabsLayout() {
  const { c } = useTheme();
  const { s } = useI18n();
  useReminderSync();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.hairline },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: s.tabs.today, tabBarIcon: ({ color }) => <Icon name="sun" color={color} size={22} /> }} />
      <Tabs.Screen name="habits" options={{ title: s.tabs.habits, tabBarIcon: ({ color }) => <Icon name="list" color={color} size={22} /> }} />
      <Tabs.Screen name="growth" options={{ title: s.tabs.growth, tabBarIcon: ({ color }) => <Icon name="trending-up" color={color} size={22} /> }} />
      <Tabs.Screen name="circle" options={{ title: s.tabs.circle, tabBarIcon: ({ color }) => <Icon name="users" color={color} size={22} /> }} />
      <Tabs.Screen name="settings" options={{ title: s.tabs.you, tabBarIcon: ({ color }) => <Icon name="user" color={color} size={22} /> }} />
    </Tabs>
  );
}
