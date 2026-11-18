import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Share, Switch, View } from "react-native";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { api } from "@/lib/api";
import { localDate } from "@/lib/date";
import type { Blessing, CircleResponse, Friend, InboxItem } from "@/lib/types";
import {
  Button,
  Card,
  Chip,
  Columns,
  ErrorText,
  Field,
  Header,
  Icon,
  IconButton,
  Row,
  Screen,
  SectionLabel,
  Segmented,
  Sheet,
  SheetAction,
  Spacer,
  Txt,
  Verse,
  Wrap,
} from "@/ui/components";
import { radius, serif, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

function ask(title: string, message: string, action: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function timeAgo(iso: string, s: Dict): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return s.circle.justNow;
  if (m < 60) return s.circle.minutesAgo(m);
  const h = Math.round(m / 60);
  if (h < 24) return s.circle.hoursAgo(h);
  return s.circle.daysAgo(Math.round(h / 24));
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}>
      <Txt v="heading" style={{ color: c.invertInk, fontSize: size * 0.4 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Txt>
    </View>
  );
}

export default function Circle() {
  const { c } = useTheme();
  const toast = useToast();
  const { s } = useI18n();
  const t = s.circle;
  const [data, setData] = useState<CircleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [friend, setFriend] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.circle(localDate());
      setData(d);
      setError(null);
      if (d.unread > 0) void api.markRead();
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn();
      if (success) toast({ text: success });
      await load();
    } catch (e) {
      toast({ text: (e as Error).message });
    }
  }

  async function enable() {
    setBusy(true);
    await run(() => api.circleSettings({ circle_enabled: true }));
    setBusy(false);
  }

  if (data && !data.settings.circle_enabled) {
    return (
      <Screen>
        <Header eyebrow={t.eyebrow} title={t.title} />
        <Txt muted style={{ fontSize: 18, lineHeight: 26 }}>
          {t.intro}
        </Txt>
        <Spacer h={space.xl} />
        {[
          ["heart", t.point1],
          ["message-circle", t.point2],
          ["shield", t.point3],
          ["lock", t.point4],
        ].map(([icon, text]) => (
          <Row key={icon} gap={space.lg} style={{ paddingVertical: space.md }}>
            <Icon name={icon!} />
            <Txt style={{ flex: 1 }}>{text}</Txt>
          </Row>
        ))}
        <Spacer h={space.xl} />
        <Card>
          <Verse text={t.verse} refText={t.verseRef} />
        </Card>
        <Spacer h={space.xl} />
        <ErrorText>{error}</ErrorText>
        <Button title={t.turnOn} onPress={enable} loading={busy} />
      </Screen>
    );
  }

  const friends = data?.friends ?? [];
  const needs = friends.filter((f) => f.needs_encouragement);

  return (
    <Screen wide>
      <Header
        eyebrow={data?.settings.friend_code ? t.yourCode(data.settings.friend_code) : t.eyebrow}
        title={t.title}
        right={
          <Row gap={space.sm}>
            <IconButton name="settings" label={t.privacy} onPress={() => setPrivacyOpen(true)} />
            <IconButton name="user-plus" label={t.addFriend} onPress={() => setAddOpen(true)} />
          </Row>
        }
      />
      <ErrorText>{error}</ErrorText>

      <Columns
        left={
          <>
      {data?.incoming.length ? (
        <>
          <SectionLabel>{t.requests}</SectionLabel>
          {data.incoming.map((r) => (
            <Row key={r.id} gap={space.lg} style={{ paddingVertical: space.md }}>
              <Avatar name={r.name} size={40} />
              <Txt v="heading" style={{ flex: 1 }}>
                {r.name}
              </Txt>
              <Button title={t.accept} small onPress={() => run(() => api.acceptFriend(r.id), t.joined(r.name))} />
              <Button title={t.decline} small variant="ghost" onPress={() => run(() => api.removeFriend(r.id))} />
            </Row>
          ))}
        </>
      ) : null}

      {data?.inbox.length ? (
        <>
          <SectionLabel>{t.forYou}</SectionLabel>
          {data.inbox.slice(0, 6).map((m) => (
            <InboxRow key={m.id} item={m} onReport={() => run(() => api.report("encouragement", m.id), s.common.reportThanks)} />
          ))}
        </>
      ) : null}

      {data?.milestones?.length ? (
        <>
          <SectionLabel>{s.v5.milestones}</SectionLabel>
          {data.milestones.map((m) => (
            <Row key={`${m.user_id}-${m.key}`} gap={space.md} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}>
              <Avatar name={m.name} size={36} />
              <Txt style={{ flex: 1 }} numberOfLines={2}>
                {s.v5.earned(m.name, s.v5.badge[m.key]?.name ?? m.key)}
              </Txt>
              {m.celebrated ? (
                <Txt v="small" muted>
                  {s.v5.celebrated}
                </Txt>
              ) : (
                <Button
                  title={s.v5.celebrate}
                  small
                  variant="secondary"
                  onPress={() => run(() => api.encourage(m.user_id, "message", { template_id: "b11" }), t.sentTo(m.name))}
                />
              )}
            </Row>
          ))}
        </>
      ) : null}

      {needs.length ? (
        <>
          <SectionLabel>{t.couldUse}</SectionLabel>
          <Wrap>
            {needs.map((f) => (
              <Chip key={f.id} label={f.name} icon="heart" onPress={() => setFriend(f)} />
            ))}
          </Wrap>
        </>
      ) : null}

      <SectionLabel
        right={
          <Pressable onPress={() => setRequestOpen(true)} hitSlop={8}>
            <Txt v="caption">{t.askForPrayer}</Txt>
          </Pressable>
        }
      >
        {t.prayerRequests}
      </SectionLabel>
      {data?.prayer_requests.length ? (
        data.prayer_requests.map((p) => (
          <View key={p.id} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}>
            <Txt v="small" muted>
              {p.mine ? t.you : p.name} · {timeAgo(p.created_at, s)}
            </Txt>
            <Txt style={{ fontFamily: serif, fontSize: 17, lineHeight: 25, marginVertical: 4 }}>{p.text}</Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt v="small" muted>
                {p.praying_count === 0 ? t.firstToPray : t.praying(p.praying_count)}
              </Txt>
              {p.mine ? (
                <Button title={s.common.close} small variant="ghost" onPress={() => run(() => api.deletePrayerRequest(p.id))} />
              ) : p.i_prayed ? (
                <Row gap={6}>
                  <Icon name="check" size={16} />
                  <Txt v="small">{t.prayingDone}</Txt>
                </Row>
              ) : (
                <Button title={t.imPraying} small icon="heart" onPress={() => run(() => api.prayFor(p.id), t.willKnowPraying(p.name))} />
              )}
            </Row>
          </View>
        ))
      ) : (
        <Txt v="small" muted>
          {t.noRequests}
        </Txt>
      )}

          </>
        }
        right={
          <>
      <SectionLabel>{`${t.friends}${friends.length ? ` · ${friends.length}` : ""}`}</SectionLabel>
      {data && friends.length === 0 && data.outgoing.length === 0 ? (
        <View style={{ alignItems: "center", gap: space.lg, paddingVertical: space.xl }}>
          <Txt muted center>
            {t.empty}
          </Txt>
          <Button title={t.invite} icon="user-plus" small variant="secondary" onPress={() => setAddOpen(true)} />
        </View>
      ) : null}
      {friends.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => setFriend(f)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: space.lg,
            paddingVertical: space.md + 2,
            borderBottomWidth: 1,
            borderBottomColor: c.hairline,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Avatar name={f.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="heading">{f.name}</Txt>
            <Txt v="small" muted numberOfLines={1}>
              {f.paused
                ? t.paused
                : [s.seasons[f.season ?? "seed"]!.title, t.dayStreak(f.streak ?? 0), f.faithfulness != null ? `${f.faithfulness}%` : null]
                    .filter(Boolean)
                    .join(" · ")}
            </Txt>
          </View>
          {!f.paused ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={f.prayed_today ? t.prayedFor(f.name) : t.sendPrayerTo(f.name)}
              hitSlop={8}
              disabled={f.prayed_today}
              onPress={() => run(() => api.encourage(f.id, "prayer"), t.willKnowPrayed(f.name))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: f.prayed_today ? c.ink : c.surface,
              }}
            >
              <Icon name="heart" size={18} color={f.prayed_today ? c.invertInk : c.ink} />
            </Pressable>
          ) : null}
        </Pressable>
      ))}
      {data?.outgoing.map((r) => (
        <Row key={r.id} gap={space.lg} style={{ paddingVertical: space.md }}>
          <Avatar name={r.name} size={40} />
          <View style={{ flex: 1 }}>
            <Txt v="heading">{r.name}</Txt>
            <Txt v="small" muted>
              {t.requestSent}
            </Txt>
          </View>
          <Button title={s.common.cancel} small variant="ghost" onPress={() => run(() => api.removeFriend(r.id))} />
        </Row>
      ))}

          </>
        }
      />

      <AddFriendSheet visible={addOpen} code={data?.settings.friend_code ?? null} onClose={() => setAddOpen(false)} onDone={load} />
      <PrayerRequestSheet visible={requestOpen} onClose={() => setRequestOpen(false)} onDone={load} />
      {data ? <PrivacySheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} settings={data.settings} onDone={load} /> : null}
      <FriendSheet friend={friend} onClose={() => setFriend(null)} onChanged={load} />
    </Screen>
  );
}

function InboxRow({ item: m, onReport }: { item: InboxItem; onReport: () => void }) {
  const { c } = useTheme();
  const { s } = useI18n();
  const t = s.circle;
  const fromRequest = m.template_id === "request" || m.text === "is praying for your request";
  const line =
    m.type === "prayer" ? (fromRequest ? t.prayingForRequest(m.from_name) : t.prayedForYou(m.from_name)) : m.type === "verse" ? t.sentVerse(m.from_name) : m.from_name;
  return (
    <Pressable
      onLongPress={onReport}
      style={{ flexDirection: "row", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}
    >
      <View style={{ width: 8, paddingTop: 8 }}>{!m.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ink }} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={6} style={{ flex: 1 }}>
            <Icon name={m.type === "prayer" ? "heart" : m.type === "verse" ? "book-open" : "message-circle"} size={14} />
            <Txt v="heading" style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
              {line}
            </Txt>
          </Row>
          <Txt v="small" muted>
            {timeAgo(m.created_at, s)}
          </Txt>
        </Row>
        {m.type !== "prayer" && m.text ? (
          <Txt style={{ fontFamily: serif, fontSize: 16, lineHeight: 23 }}>
            “{m.text}”{m.ref ? <Txt v="small" muted>{`  ${m.ref}`}</Txt> : null}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

function AddFriendSheet({ visible, code, onClose, onDone }: { visible: boolean; code: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { s } = useI18n();
  const t = s.circle;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.addFriend(value);
      setValue("");
      onClose();
      toast({ text: r.status === "accepted" ? t.joined(r.friend.name) : t.requestSentTo(r.friend.name) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t.addFriend}>
      {code ? (
        <Card style={{ alignItems: "center", marginBottom: space.lg }}>
          <Txt v="caption" muted>
            {t.yourCodeLabel}
          </Txt>
          <Txt v="title" style={{ letterSpacing: 3, marginVertical: space.sm }}>
            {code}
          </Txt>
          <Button title={t.shareInvite} icon="share" small variant="ghost" onPress={() => Share.share({ message: t.inviteMessage(code) })} />
        </Card>
      ) : null}
      <Field label={t.theirCode} value={value} onChangeText={setValue} autoCapitalize="characters" placeholder="ABCD-EFGH" maxLength={12} onSubmitEditing={add} />
      <ErrorText>{error}</ErrorText>
      <Button title={t.sendRequest} onPress={add} loading={busy} disabled={value.replace(/[^a-z0-9]/gi, "").length < 8} />
    </Sheet>
  );
}

function PrayerRequestSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { s } = useI18n();
  const t = s.circle;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.createPrayerRequest(text);
      setText("");
      onClose();
      toast({ text: t.askShared, ref: t.askRef });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={visible} onClose={onClose} title={t.askTitle}>
      <Txt muted>{t.askIntro}</Txt>
      <Spacer h={space.lg} />
      <Field value={text} onChangeText={setText} placeholder={t.askPh} multiline maxLength={280} style={{ minHeight: 100 }} />
      <ErrorText>{error}</ErrorText>
      <Button title={t.askShare} onPress={save} loading={busy} disabled={!text.trim()} />
    </Sheet>
  );
}

function PrivacySheet({
  visible,
  onClose,
  settings,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  settings: CircleResponse["settings"];
  onDone: () => void;
}) {
  const { c } = useTheme();
  const { s } = useI18n();
  const t = s.circle;
  const set = async (patch: Partial<CircleResponse["settings"]>) => {
    await api.circleSettings(patch).catch(() => {});
    onDone();
  };
  const toggle = (label: string, hint: string, value: boolean, key: "share_struggling") => (
    <Row gap={space.lg} style={{ paddingVertical: space.md }}>
      <View style={{ flex: 1 }}>
        <Txt v="heading" style={{ fontSize: 15 }}>
          {label}
        </Txt>
        <Txt v="small" muted>
          {hint}
        </Txt>
      </View>
      <Switch value={value} onValueChange={(v) => set({ [key]: v })} trackColor={{ true: c.ink, false: c.hairline }} thumbColor={c.bg} />
    </Row>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title={t.privacy}>
      <Txt v="small" muted style={{ marginBottom: space.md }}>
        {t.privacyNote}
      </Txt>
      {toggle(t.quietNudge, t.quietNudgeHint, settings.share_struggling, "share_struggling")}
      <Txt v="caption" muted style={{ marginTop: space.lg, marginBottom: space.sm }}>
        {t.messagesIReceive}
      </Txt>
      <Segmented
        value={settings.allow_messages}
        onChange={(v) => set({ allow_messages: v })}
        options={[
          { value: "everyone", label: t.blessingsAndNotes },
          { value: "templates", label: t.blessingsOnly },
        ]}
      />
      <Spacer h={space.xl} />
      <Button title={t.pause} variant="ghost" onPress={() => set({ circle_enabled: false }).then(onClose)} />
    </Sheet>
  );
}

function FriendSheet({ friend: f, onClose, onChanged }: { friend: Friend | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { s, category } = useI18n();
  const t = s.circle;
  const [mode, setMode] = useState<"main" | "blessing" | "verse" | "note">("main");
  const [lists, setLists] = useState<{ blessings: Blessing[]; verses: Blessing[] } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode("main");
    setNote("");
    setError(null);
    onClose();
  };

  async function open(m: "blessing" | "verse" | "note") {
    setMode(m);
    // Reload each time so the list follows the current language.
    setLists(await api.blessings().catch(() => ({ blessings: [], verses: [] })));
  }

  async function send(type: "prayer" | "message" | "verse", opts: { template_id?: string; text?: string } = {}) {
    if (!f) return;
    setError(null);
    try {
      const r = await api.encourage(f.id, type, opts);
      close();
      toast({ text: type === "prayer" ? (r.status === "already_prayed" ? t.alreadyPrayed(f.name) : t.willKnowPrayed(f.name)) : t.sentTo(f.name) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(kind: "remove" | "block") {
    if (!f) return;
    const ok = await ask(
      kind === "remove" ? t.removeTitle(f.name) : t.blockTitle(f.name),
      kind === "remove" ? t.removeBody : t.blockBody,
      kind === "remove" ? s.common.remove : s.common.block,
      s.common.cancel,
    );
    if (!ok) return;
    try {
      if (kind === "remove") await api.removeFriend(f.id);
      else await api.blockFriend(f.id);
      close();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!f) return <Sheet visible={false} onClose={close}>{null}</Sheet>;
  const season = s.seasons[f.season ?? "seed"]!;

  return (
    <Sheet visible onClose={close} title={f.name}>
      {mode === "main" ? (
        <>
          {!f.paused ? (
            <>
              <Txt v="caption" muted>
                {season.title} · {season.line}
              </Txt>
              <Row gap={space.md} style={{ marginVertical: space.lg }}>
                {[
                  [`${f.faithfulness ?? "—"}${f.faithfulness != null ? "%" : ""}`, t.faithful],
                  [`${f.streak ?? 0}`, t.dayStreakLabel],
                  [`${f.days_showed_up ?? 0}`, t.daysShowedUp],
                ].map(([v, l]) => (
                  <View key={l} style={{ flex: 1 }}>
                    <Txt v="title">{v}</Txt>
                    <Txt v="small" muted>
                      {l}
                    </Txt>
                  </View>
                ))}
              </Row>
              {f.areas?.length ? (
                <Txt v="small" muted style={{ marginBottom: space.sm }}>
                  {t.growingIn(f.areas.map((a) => category(a.id, a.name)).join(", "))}
                </Txt>
              ) : null}
              <ErrorText>{error}</ErrorText>
              <SheetAction icon="heart" label={f.prayed_today ? t.youPrayedToday : t.sendPrayer} onPress={() => send("prayer")} />
              <SheetAction icon="gift" label={t.sendBlessing} onPress={() => open("blessing")} />
              <SheetAction icon="book-open" label={t.sendVerse} onPress={() => open("verse")} />
              {f.accepts_custom ? <SheetAction icon="edit-3" label={t.writeNote} onPress={() => open("note")} /> : null}
            </>
          ) : (
            <Txt muted>{t.pausedLong(f.name)}</Txt>
          )}
          <Spacer h={space.sm} />
          <Row gap={space.sm} style={{ justifyContent: "center" }}>
            <Button title={s.common.remove} small variant="ghost" onPress={() => remove("remove")} />
            <Button title={s.common.block} small variant="ghost" onPress={() => remove("block")} />
            <Button
              title={s.common.report}
              small
              variant="danger"
              onPress={async () => {
                await api.report("user", f.id).catch(() => {});
                toast({ text: s.common.reportThanks });
              }}
            />
          </Row>
        </>
      ) : null}

      {mode === "blessing" || mode === "verse" ? (
        <View style={{ gap: space.sm }}>
          {(mode === "blessing" ? lists?.blessings : lists?.verses)?.slice(0, mode === "verse" ? 8 : 10).map((b) => (
            <Pressable
              key={b.id}
              onPress={() => send(mode === "blessing" ? "message" : "verse", { template_id: b.id })}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <BlessingCard b={b} />
            </Pressable>
          ))}
          <ErrorText>{error}</ErrorText>
          <Button title={s.common.back} variant="ghost" onPress={() => setMode("main")} />
        </View>
      ) : null}

      {mode === "note" ? (
        <>
          <Field value={note} onChangeText={setNote} placeholder={t.notePh(f.name)} multiline maxLength={200} style={{ minHeight: 90 }} />
          <ErrorText>{error}</ErrorText>
          <Button title={s.common.send} onPress={() => send("message", { text: note })} disabled={!note.trim()} />
          <Button title={s.common.back} variant="ghost" onPress={() => setMode("main")} />
        </>
      ) : null}
    </Sheet>
  );
}

function BlessingCard({ b }: { b: Blessing }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg }}>
      <Txt style={{ fontFamily: serif, fontSize: 16, lineHeight: 22 }} numberOfLines={3}>
        {b.text}
      </Txt>
      {b.ref ? (
        <Txt v="small" muted style={{ marginTop: 4 }}>
          {b.ref}
        </Txt>
      ) : null}
    </View>
  );
}
