import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Share, Switch, View } from "react-native";
import { api } from "@/lib/api";
import { localDate } from "@/lib/date";
import { SEASON_COPY } from "@/lib/suggestions";
import type { Blessing, CircleResponse, Friend, InboxItem } from "@/lib/types";
import {
  Button,
  Card,
  Chip,
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

function ask(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
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
        <Header eyebrow="Friends-only" title="Circle" />
        <Txt muted style={{ fontSize: 18, lineHeight: 26 }}>
          Invite a few people you trust. Share your growth, never your private habits, and carry each other in prayer.
        </Txt>
        <Spacer h={space.xl} />
        {[
          ["heart", "Send a prayer with one tap"],
          ["message-circle", "Encourage each other with blessings and verses"],
          ["shield", "Only people you add. No public profiles, no comparing."],
          ["lock", "Habit names and Freedom habits stay private"],
        ].map(([icon, text]) => (
          <Row key={text} gap={space.lg} style={{ paddingVertical: space.md }}>
            <Icon name={icon!} />
            <Txt style={{ flex: 1 }}>{text}</Txt>
          </Row>
        ))}
        <Spacer h={space.xl} />
        <Card>
          <Verse text="Bear one another's burdens, and so fulfill the law of Christ." refText="Galatians 6:2" />
        </Card>
        <Spacer h={space.xl} />
        <ErrorText>{error}</ErrorText>
        <Button title="Turn on my Circle" onPress={enable} loading={busy} />
      </Screen>
    );
  }

  const friends = data?.friends ?? [];
  const needs = friends.filter((f) => f.needs_encouragement);

  return (
    <Screen>
      <Header
        eyebrow={data?.settings.friend_code ? `Your code · ${data.settings.friend_code}` : "Friends-only"}
        title="Circle"
        right={
          <Row gap={space.sm}>
            <IconButton name="settings" label="Circle privacy" onPress={() => setPrivacyOpen(true)} />
            <IconButton name="user-plus" label="Add a friend" onPress={() => setAddOpen(true)} />
          </Row>
        }
      />
      <ErrorText>{error}</ErrorText>

      {data?.incoming.length ? (
        <>
          <SectionLabel>Requests</SectionLabel>
          {data.incoming.map((r) => (
            <Row key={r.id} gap={space.lg} style={{ paddingVertical: space.md }}>
              <Avatar name={r.name} size={40} />
              <Txt v="heading" style={{ flex: 1 }}>
                {r.name}
              </Txt>
              <Button title="Accept" small onPress={() => run(() => api.acceptFriend(r.id), `${r.name} joined your circle`)} />
              <Button title="Decline" small variant="ghost" onPress={() => run(() => api.removeFriend(r.id))} />
            </Row>
          ))}
        </>
      ) : null}

      {data?.inbox.length ? (
        <>
          <SectionLabel>For you</SectionLabel>
          {data.inbox.slice(0, 6).map((m) => (
            <InboxRow key={m.id} item={m} onReport={() => run(() => api.report("encouragement", m.id), "Thanks. We'll review it.")} />
          ))}
        </>
      ) : null}

      {needs.length ? (
        <>
          <SectionLabel>Could use encouragement</SectionLabel>
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
            <Txt v="caption">+ Ask for prayer</Txt>
          </Pressable>
        }
      >
        Prayer requests
      </SectionLabel>
      {data?.prayer_requests.length ? (
        data.prayer_requests.map((p) => (
          <View key={p.id} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}>
            <Txt v="small" muted>
              {p.mine ? "You" : p.name} · {timeAgo(p.created_at)}
            </Txt>
            <Txt style={{ fontFamily: serif, fontSize: 17, lineHeight: 25, marginVertical: 4 }}>{p.text}</Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt v="small" muted>
                {p.praying_count === 0 ? "Be the first to pray" : `${p.praying_count} praying`}
              </Txt>
              {p.mine ? (
                <Button title="Close" small variant="ghost" onPress={() => run(() => api.deletePrayerRequest(p.id))} />
              ) : p.i_prayed ? (
                <Row gap={6}>
                  <Icon name="check" size={16} />
                  <Txt v="small">Praying</Txt>
                </Row>
              ) : (
                <Button title="I'm praying" small icon="heart" onPress={() => run(() => api.prayFor(p.id), `${p.name} will know you're praying.`)} />
              )}
            </Row>
          </View>
        ))
      ) : (
        <Txt v="small" muted>
          No open requests. Share what's on your heart. Requests close after 7 days.
        </Txt>
      )}

      <SectionLabel>{`Friends${friends.length ? ` · ${friends.length}` : ""}`}</SectionLabel>
      {data && friends.length === 0 && data.outgoing.length === 0 ? (
        <View style={{ alignItems: "center", gap: space.lg, paddingVertical: space.xl }}>
          <Txt muted center>
            Your circle is empty. Invite someone you trust to grow with.
          </Txt>
          <Button title="Invite a friend" icon="user-plus" small variant="secondary" onPress={() => setAddOpen(true)} />
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
                ? "Circle paused"
                : [SEASON_COPY[f.season ?? "seed"]!.title, `${f.streak ?? 0}-day streak`, f.faithfulness != null ? `${f.faithfulness}%` : null]
                    .filter(Boolean)
                    .join(" · ")}
            </Txt>
          </View>
          {!f.paused ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={f.prayed_today ? `You prayed for ${f.name} today` : `Send a prayer to ${f.name}`}
              hitSlop={8}
              disabled={f.prayed_today}
              onPress={() => run(() => api.encourage(f.id, "prayer"), `${f.name} will know you prayed.`)}
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
              Request sent
            </Txt>
          </View>
          <Button title="Cancel" small variant="ghost" onPress={() => run(() => api.removeFriend(r.id))} />
        </Row>
      ))}

      <AddFriendSheet visible={addOpen} code={data?.settings.friend_code ?? null} onClose={() => setAddOpen(false)} onDone={load} />
      <PrayerRequestSheet visible={requestOpen} onClose={() => setRequestOpen(false)} onDone={load} />
      {data ? <PrivacySheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} settings={data.settings} onDone={load} /> : null}
      <FriendSheet friend={friend} onClose={() => setFriend(null)} onChanged={load} />
    </Screen>
  );
}

function InboxRow({ item: m, onReport }: { item: InboxItem; onReport: () => void }) {
  const { c } = useTheme();
  const line =
    m.type === "prayer" ? `${m.from_name} ${m.text || "prayed for you"}` : m.type === "verse" ? `${m.from_name} sent you a verse` : `${m.from_name}`;
  return (
    <Pressable
      onLongPress={onReport}
      style={{ flexDirection: "row", gap: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.hairline }}
    >
      <View style={{ width: 8, paddingTop: 8 }}>{!m.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ink }} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={6}>
            <Icon name={m.type === "prayer" ? "heart" : m.type === "verse" ? "book-open" : "message-circle"} size={14} />
            <Txt v="heading" style={{ fontSize: 15 }}>
              {line}
            </Txt>
          </Row>
          <Txt v="small" muted>
            {timeAgo(m.created_at)}
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
      toast({ text: r.status === "accepted" ? `${r.friend.name} joined your circle.` : `Request sent to ${r.friend.name}.` });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add a friend">
      {code ? (
        <Card style={{ alignItems: "center", marginBottom: space.lg }}>
          <Txt v="caption" muted>
            Your code
          </Txt>
          <Txt v="title" style={{ letterSpacing: 3, marginVertical: space.sm }}>
            {code}
          </Txt>
          <Button
            title="Share invite"
            icon="share"
            small
            variant="ghost"
            onPress={() => Share.share({ message: `Grow with me on Still Growing. Add me with my code: ${code}` })}
          />
        </Card>
      ) : null}
      <Field label="Their code" value={value} onChangeText={setValue} autoCapitalize="characters" placeholder="ABCD-EFGH" maxLength={12} onSubmitEditing={add} />
      <ErrorText>{error}</ErrorText>
      <Button title="Send request" onPress={add} loading={busy} disabled={value.replace(/[^a-z0-9]/gi, "").length < 8} />
    </Sheet>
  );
}

function PrayerRequestSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
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
      toast({ text: "Your circle can see your request.", ref: "Philippians 4:6" });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Ask for prayer">
      <Txt muted>Share only what you're comfortable with. Your friends will see it for 7 days.</Txt>
      <Spacer h={space.lg} />
      <Field value={text} onChangeText={setText} placeholder="Pray for my consistency this week…" multiline maxLength={280} style={{ minHeight: 100 }} />
      <ErrorText>{error}</ErrorText>
      <Button title="Share with my circle" onPress={save} loading={busy} disabled={!text.trim()} />
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
  const set = async (patch: Partial<CircleResponse["settings"]>) => {
    await api.circleSettings(patch).catch(() => {});
    onDone();
  };
  const toggle = (label: string, hint: string, value: boolean, key: "share_identity" | "share_struggling") => (
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
    <Sheet visible={visible} onClose={onClose} title="Circle privacy">
      <Txt v="small" muted style={{ marginBottom: space.md }}>
        Friends always see your growth season, streak and faithfulness. They never see habit names, reflections or Freedom habits.
      </Txt>
      {toggle("Show my identity statement", "“In Christ, I'm becoming someone who…”", settings.share_identity, "share_identity")}
      {toggle("Let my circle know when I'm quiet", "After 3 days without a check-in, friends get a gentle nudge to encourage you", settings.share_struggling, "share_struggling")}
      <Txt v="caption" muted style={{ marginTop: space.lg, marginBottom: space.sm }}>
        Messages I receive
      </Txt>
      <Segmented
        value={settings.allow_messages}
        onChange={(v) => set({ allow_messages: v })}
        options={[
          { value: "everyone", label: "Blessings + notes" },
          { value: "templates", label: "Blessings only" },
        ]}
      />
      <Spacer h={space.xl} />
      <Button title="Pause my Circle" variant="ghost" onPress={() => set({ circle_enabled: false }).then(onClose)} />
    </Sheet>
  );
}

function FriendSheet({ friend: f, onClose, onChanged }: { friend: Friend | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
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
    if (!lists) setLists(await api.blessings().catch(() => ({ blessings: [], verses: [] })));
  }

  async function send(type: "prayer" | "message" | "verse", opts: { template_id?: string; text?: string } = {}) {
    if (!f) return;
    setError(null);
    try {
      const r = await api.encourage(f.id, type, opts);
      close();
      toast({ text: type === "prayer" ? (r.status === "already_prayed" ? `You already prayed for ${f.name} today.` : `${f.name} will know you prayed.`) : `Sent to ${f.name}.` });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(kind: "remove" | "block") {
    if (!f) return;
    const ok = await ask(
      kind === "remove" ? `Remove ${f.name}?` : `Block ${f.name}?`,
      kind === "remove" ? "You can add each other again later with your codes." : "They won't be able to see you, message you or add you again.",
      kind === "remove" ? "Remove" : "Block",
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
  const season = SEASON_COPY[f.season ?? "seed"]!;

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
                  [`${f.faithfulness ?? "—"}${f.faithfulness != null ? "%" : ""}`, "faithful"],
                  [`${f.streak ?? 0}`, "day streak"],
                  [`${f.days_showed_up ?? 0}`, "days showed up"],
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
                  Growing in {f.areas.map((a) => a.name).join(", ")}
                </Txt>
              ) : null}
              {f.identity_statement ? (
                <Txt style={{ fontFamily: serif, fontStyle: "italic", marginBottom: space.sm }}>
                  “Becoming someone who {f.identity_statement}”
                </Txt>
              ) : null}
              <ErrorText>{error}</ErrorText>
              <SheetAction icon="heart" label={f.prayed_today ? "You prayed today" : "Send a prayer"} onPress={() => send("prayer")} />
              <SheetAction icon="gift" label="Send a blessing" onPress={() => open("blessing")} />
              <SheetAction icon="book-open" label="Send a verse" onPress={() => open("verse")} />
              {f.accepts_custom ? <SheetAction icon="edit-3" label="Write a note" onPress={() => open("note")} /> : null}
            </>
          ) : (
            <Txt muted>{f.name} has paused their circle for now.</Txt>
          )}
          <Spacer h={space.sm} />
          <Row gap={space.sm} style={{ justifyContent: "center" }}>
            <Button title="Remove" small variant="ghost" onPress={() => remove("remove")} />
            <Button title="Block" small variant="ghost" onPress={() => remove("block")} />
            <Button
              title="Report"
              small
              variant="danger"
              onPress={async () => {
                await api.report("user", f.id).catch(() => {});
                toast({ text: "Thanks. We'll review it." });
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
          <Button title="Back" variant="ghost" onPress={() => setMode("main")} />
        </View>
      ) : null}

      {mode === "note" ? (
        <>
          <Field value={note} onChangeText={setNote} placeholder={`Write something kind to ${f.name}…`} multiline maxLength={200} style={{ minHeight: 90 }} />
          <ErrorText>{error}</ErrorText>
          <Button title="Send" onPress={() => send("message", { text: note })} disabled={!note.trim()} />
          <Button title="Back" variant="ghost" onPress={() => setMode("main")} />
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
