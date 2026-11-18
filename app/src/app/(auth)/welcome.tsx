import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Screen, Spacer, Txt, Verse } from "@/ui/components";
import { ServerPicker } from "@/ui/ServerPicker";
import { space, useTheme } from "@/ui/theme";

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingBottom: space.xl }}>
        <View style={{ marginTop: space.xxxl }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.ink, marginBottom: space.xxl }} />
          <Txt v="display" style={{ fontSize: 44, lineHeight: 48 }}>
            Still{"\n"}Growing.
          </Txt>
          <Spacer h={space.lg} />
          <Txt muted style={{ fontSize: 18, lineHeight: 26 }}>
            Build habits that shape who you're becoming, with a daily reminder that God is with you.
          </Txt>
        </View>
        <Verse text="He who began a good work in you will complete it." refText="Philippians 1:6" />
        <View style={{ gap: space.md }}>
          <Button title="Get started" onPress={() => router.push("/sign-up")} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push("/sign-in")} />
          <ServerPicker />
        </View>
      </View>
    </Screen>
  );
}
