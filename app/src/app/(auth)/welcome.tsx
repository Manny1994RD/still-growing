import { useRouter } from "expo-router";
import { View } from "react-native";
import { useI18n } from "@/i18n";
import { Button, Screen, Spacer, Txt, Verse } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { ServerPicker } from "@/ui/ServerPicker";
import { space, useTheme } from "@/ui/theme";

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const { s } = useI18n();
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingBottom: space.xl }}>
        <View style={{ marginTop: space.xxl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.xxl }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.ink }} />
            <View style={{ width: 190 }}>
              <LanguageToggle />
            </View>
          </View>
          <Txt v="display" style={{ fontSize: 44, lineHeight: 48 }}>
            {s.welcome.title}
          </Txt>
          <Spacer h={space.lg} />
          <Txt muted style={{ fontSize: 18, lineHeight: 26 }}>
            {s.welcome.tagline}
          </Txt>
        </View>
        <Verse text={s.welcome.verse} refText={s.welcome.verseRef} />
        <View style={{ gap: space.md }}>
          <Button title={s.welcome.start} onPress={() => router.push("/sign-up")} />
          <Button title={s.welcome.haveAccount} variant="ghost" onPress={() => router.push("/sign-in")} />
          <ServerPicker />
        </View>
      </View>
    </Screen>
  );
}
