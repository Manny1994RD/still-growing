import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { listenForDoneActions, scheduleWeek } from "@/lib/notifications";
import { Icon } from "@/ui/components";
import { useLayout, useTheme } from "@/ui/theme";

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
    const sub = AppState.addEventListener("change", (st) => st === "active" && void sync());
    const stopDone = listenForDoneActions();
    return () => {
      sub.remove();
      stopDone();
    };
  }, [user]);
}

export default function TabsLayout() {
  const { c } = useTheme();
  const { s } = useI18n();
  const { wide } = useLayout();
  useReminderSync();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.muted,
        // Tablets and desktop: a navigation rail on the left instead of a bottom bar.
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarLabelPosition: wide ? "below-icon" : undefined,
        tabBarStyle: wide
          ? { backgroundColor: c.bg, borderRightColor: c.hairline, borderRightWidth: 1, width: 104, paddingTop: 24 }
          : { backgroundColor: c.bg, borderTopColor: c.hairline },
        tabBarItemStyle: wide ? { height: 72, marginVertical: 4 } : undefined,
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
