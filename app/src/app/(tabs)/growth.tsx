import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Share, View } from "react-native";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDate, parseDate } from "@/lib/date";
import type { Stats } from "@/lib/types";
import { Button, Card, ErrorText, Header, Icon, ProgressBar, Row, Screen, SectionLabel, Spacer, Txt } from "@/ui/components";
import { radius, space, useTheme } from "@/ui/theme";

const SEASON_ORDER = ["seed", "sprout", "rooted", "fruitful", "overflowing"];

export default function Growth() {
  const { user } = useAuth();
  const { c } = useTheme();
  const { s, category } = useI18n();
  const g = s.growth;
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .stats(localDate())
        .then((st) => {
          setStats(st);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, []),
  );

  const season = s.seasons[stats?.season ?? "seed"]!;
  const seasonIdx = SEASON_ORDER.indexOf(stats?.season ?? "seed");

  async function share() {
    if (!stats) return;
    const areas = stats.categories.filter((x) => x.id !== "freedom").map((x) => category(x.id, x.name));
    await Share.share({
      message: g.shareMessage(season.title, stats.days_showed_up, stats.streak.current, stats.faithfulness, areas, user?.identity_statement ?? ""),
    });
  }

  // Calendar: last 35 days in 5 rows of 7, aligned so columns are weekdays.
  const hist = stats?.history ?? [];
  const firstWeekday = hist.length ? parseDate(hist[0]!.date).getDay() : 0;
  const today = localDate();

  return (
    <Screen>
      <Header eyebrow={g.eyebrow} title={season.title} />
      <Txt muted style={{ marginTop: -space.md }}>
        {season.line}
      </Txt>
      <Spacer h={space.lg} />
      <Row gap={6}>
        {SEASON_ORDER.map((sn, i) => (
          <View key={sn} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= seasonIdx ? c.ink : c.hairline }} />
        ))}
      </Row>
      <ErrorText>{error}</ErrorText>

      <SectionLabel>{g.last30}</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        <Stat label={g.faithfulness} value={stats?.faithfulness == null ? "—" : `${stats.faithfulness}%`} />
        <Stat label={g.currentStreak} value={`${stats?.streak.current ?? 0}`} suffix={s.common.days(stats?.streak.current ?? 0)} />
        <Stat label={g.daysShowedUp} value={`${stats?.days_showed_up ?? 0}`} />
        <Stat label={g.longestStreak} value={`${stats?.streak.longest ?? 0}`} suffix={s.common.days(stats?.streak.longest ?? 0)} />
      </View>
      {stats?.streak.graceUsedThisWeek ? (
        <Row style={{ marginTop: space.md }} gap={space.sm}>
          <Icon name="feather" size={14} color={c.muted} />
          <Txt v="small" muted style={{ flex: 1 }}>
            {g.grace}
          </Txt>
        </Row>
      ) : null}

      <SectionLabel>{g.fiveWeeks}</SectionLabel>
      <Card>
        <Row gap={8} style={{ marginBottom: space.md }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Txt key={i} v="caption" muted style={{ flex: 1, textAlign: "center" }}>
              {s.schedule.letters[(firstWeekday + i) % 7]}
            </Txt>
          ))}
        </Row>
        <View style={{ gap: 8 }}>
          {Array.from({ length: Math.ceil(hist.length / 7) }, (_, row) => (
            <Row key={row} gap={8}>
              {hist.slice(row * 7, row * 7 + 7).map((d) => {
                const r = d.due ? d.kept / d.due : 0;
                const isToday = d.date === today;
                return (
                  <View
                    key={d.date}
                    accessibilityLabel={`${d.date}: ${d.kept}/${d.due}`}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      backgroundColor: d.due === 0 || r === 0 ? "transparent" : c.ink,
                      opacity: r === 0 ? 1 : 0.3 + r * 0.7,
                      borderWidth: isToday ? 1.5 : r === 0 ? 1 : 0,
                      borderColor: isToday ? c.ink : c.hairline,
                    }}
                  />
                );
              })}
            </Row>
          ))}
        </View>
      </Card>

      {stats?.categories.length ? (
        <>
          <SectionLabel>{g.balance}</SectionLabel>
          {stats.categories.map((cat) => (
            <View key={cat.id} style={{ marginBottom: space.lg }}>
              <Row style={{ justifyContent: "space-between", marginBottom: space.sm }}>
                <Row gap={space.sm}>
                  <Icon name={cat.icon} size={16} />
                  <Txt v="heading" style={{ fontSize: 15 }}>
                    {category(cat.id, cat.name)}
                  </Txt>
                </Row>
                <Txt v="small" muted>
                  {cat.faithfulness === null ? g.new : `${cat.faithfulness}%`}
                </Txt>
              </Row>
              <ProgressBar value={(cat.faithfulness ?? 0) / 100} />
            </View>
          ))}
        </>
      ) : null}

      <Spacer h={space.xl} />
      <Button title={g.share} icon="share" variant="secondary" onPress={share} disabled={!stats} />
      <Spacer h={space.sm} />
      <Txt v="small" muted center>
        {g.shareNote}
      </Txt>
    </Screen>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg + 2 }}>
      <Row gap={6} style={{ alignItems: "baseline" }}>
        <Txt v="number">{value}</Txt>
        {suffix ? (
          <Txt v="small" muted>
            {suffix}
          </Txt>
        ) : null}
      </Row>
      <Txt v="small" muted style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}
