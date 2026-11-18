import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { Button, Spacer, Txt, Verse } from "@/ui/components";
import { LanguageToggle } from "@/ui/LanguageToggle";
import { ServerPicker } from "@/ui/ServerPicker";
import { space, useLayout, useTheme } from "@/ui/theme";

/**
 * First screen. Scrolls on small phones so nothing is ever cut off, and
 * keeps the buttons at the bottom on taller screens.
 */
export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const { s } = useI18n();
  const { compact, wide } = useLayout();
  const titleSize = compact ? 36 : wide ? 56 : 44;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingVertical: space.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "space-between", gap: space.xl }}>
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.lg, marginBottom: compact ? space.xl : space.xxl }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink }} />
              <View style={{ flex: 1, maxWidth: 200 }}>
                <LanguageToggle />
              </View>
            </View>
            <Txt v="display" style={{ fontSize: titleSize, lineHeight: titleSize * 1.1 }}>
              {s.welcome.title}
            </Txt>
            <Spacer h={space.lg} />
            <Txt muted style={{ fontSize: compact ? 16 : 18, lineHeight: compact ? 23 : 26 }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}
