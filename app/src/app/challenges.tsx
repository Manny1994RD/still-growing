import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { localDate } from "@/lib/date";
import type { ChallengeInfo } from "@/lib/types";
import { Button, Card, ErrorText, Header, IconButton, ProgressBar, Row, Screen, Spacer, Txt } from "@/ui/components";
import { space } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/** Guided challenges: join in one tap; friends in your circle doing the same one are shown. */
export default function Challenges() {
  const router = useRouter();
  const toast = useToast();
  const { s, unit } = useI18n();
  const v = s.v5;
  const [list, setList] = useState<ChallengeInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .challenges(localDate())
      .then((r) => {
        setList(r.challenges);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function join(ch: ChallengeInfo) {
    setBusy(ch.key);
    try {
      await api.joinChallenge(ch.key, localDate());
      toast({ text: v.joinedToast(ch.title) });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function leave(ch: ChallengeInfo) {
    const ok =
      Platform.OS === "web"
        ? (globalThis.confirm?.(`${v.leaveTitle}\n\n${v.leaveBody}`) ?? false)
        : await new Promise<boolean>((res) =>
            Alert.alert(v.leaveTitle, v.leaveBody, [
              { text: s.common.cancel, style: "cancel", onPress: () => res(false) },
              { text: v.leave, style: "destructive", onPress: () => res(true) },
            ]),
          );
    if (!ok) return;
    await api.leaveChallenge(ch.key).catch((e) => setError(e.message));
    load();
  }

  return (
    <Screen edges={Platform.OS === "ios" ? [] : ["top"]}>
      <Row style={{ marginBottom: space.lg }}>
        <IconButton name="x" label={s.common.close} onPress={() => (router.canGoBack() ? router.back() : router.replace("/habits"))} />
      </Row>
      <Header eyebrow="🏁" title={v.challenges} />
      <Txt muted>{v.challengesIntro}</Txt>
      <Spacer h={space.lg} />
      <ErrorText>{error}</ErrorText>
      {(list ?? []).map((ch) => (
        <Card key={ch.key} style={{ marginBottom: space.lg }}>
          <Row gap={space.md} style={{ alignItems: "flex-start" }}>
            <Txt style={{ fontSize: 34, lineHeight: 42 }}>{ch.emoji}</Txt>
            <View style={{ flex: 1 }}>
              <Txt v="heading">{ch.title}</Txt>
              <Txt v="small" muted>
                {v.days(ch.days)}
                {ch.completed_times ? ` · ${v.completedTimes(ch.completed_times)}` : ""}
              </Txt>
            </View>
          </Row>
          <Txt style={{ marginTop: space.md }}>{ch.description}</Txt>
          <Txt v="caption" muted style={{ marginTop: space.md, marginBottom: 4 }}>
            {v.includes}
          </Txt>
          {ch.habits.map((h) => (
            <Txt key={h.name} v="small">
              {h.emoji} {h.name}
              {h.type === "count" || h.type === "time" || h.type === "weekly" ? ` · ${h.target} ${unit(h.unit)}` : ""}
            </Txt>
          ))}
          {ch.friends.length ? (
            <Txt v="small" style={{ marginTop: space.md, fontWeight: "600" }}>
              👥 {v.friendsIn(ch.friends.join(", "))}
            </Txt>
          ) : null}
          <Spacer h={space.lg} />
          {ch.joined ? (
            <>
              <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <Txt v="small" style={{ fontWeight: "600" }}>
                  {v.joined(ch.joined.day, ch.days)}
                </Txt>
                {ch.joined.faithfulness != null ? (
                  <Txt v="small" muted>
                    {ch.joined.faithfulness}%
                  </Txt>
                ) : null}
              </Row>
              <ProgressBar value={ch.joined.day / ch.days} />
              <Spacer h={space.md} />
              <Button title={v.leave} small variant="ghost" onPress={() => leave(ch)} />
            </>
          ) : (
            <Button title={v.join} onPress={() => join(ch)} loading={busy === ch.key} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
