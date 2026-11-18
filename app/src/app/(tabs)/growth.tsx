import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Share, View } from "react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { localDate, parseDate, WEEKDAYS } from "@/lib/date";
import { SEASON_COPY } from "@/lib/suggestions";
import type { Stats } from "@/lib/types";
import { Button, Card, ErrorText, Header, Icon, ProgressBar, Row, Screen, SectionLabel, Spacer, Txt } from "@/ui/components";
import { radius, space, useTheme } from "@/ui/theme";

const SEASON_ORDER = ["seed", "sprout", "rooted", "fruitful", "overflowing"];

export default function Growth() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .stats(localDate())
        .then((s) => {
          setStats(s);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, []),
  );

  const season = SEASON_COPY[stats?.season ?? "seed"]!;
  const seasonIdx = SEASON_ORDER.indexOf(stats?.season ?? "seed");

  async function share() {
    if (!stats) return;
    const areas = stats.categories.filter((x) => x.id !== "freedom").map((x) => x.name);
    await Share.share({
      message:
        `I'm ${season.title} on Still Growing 🌱\n` +
        `${stats.days_showed_up} days showed up · ${stats.streak.current}-day streak` +
        (stats.faithfulness !== null ? ` · ${stats.faithfulness}% faithful` : "") +
        (areas.length ? `\nGrowing in ${areas.join(", ")}.` : "") +
        (user?.identity_statement ? `\n“In Christ, I'm becoming someone who ${user.identity_statement}”` : ""),
    });
  }

  // Calendar: last 35 days in 5 rows of 7, aligned so columns are weekdays.
  const hist = stats?.history ?? [];
  const firstWeekday = hist.length ? parseDate(hist[0]!.date).getDay() : 0;

  return (
    <Screen>
      <Header eyebrow="Your growth" title={season.title} />
      <Txt muted style={{ marginTop: -space.md }}>
        {season.line}
      </Txt>
      <Spacer h={space.lg} />
      <Row gap={6}>
        {SEASON_ORDER.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= seasonIdx ? c.ink : c.hairline }} />
        ))}
      </Row>
      <ErrorText>{error}</ErrorText>

      <SectionLabel>Last 30 days</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        <Stat label="Faithfulness" value={stats?.faithfulness === null || !stats ? "—" : `${stats.faithfulness}%`} />
        <Stat label="Current streak" value={`${stats?.streak.current ?? 0}`} suffix={stats?.streak.current === 1 ? "day" : "days"} />
        <Stat label="Days showed up" value={`${stats?.days_showed_up ?? 0}`} />
        <Stat label="Longest streak" value={`${stats?.streak.longest ?? 0}`} suffix={stats?.streak.longest === 1 ? "day" : "days"} />
      </View>
      {stats?.streak.graceUsedThisWeek ? (
        <Row style={{ marginTop: space.md }} gap={space.sm}>
          <Icon name="feather" size={14} color={c.muted} />
          <Txt v="small" muted>
            Grace covered a missed day this week. Your streak is safe.
          </Txt>
        </Row>
      ) : null}

      <SectionLabel>Five weeks</SectionLabel>
      <Card>
        <Row gap={8} style={{ marginBottom: space.md }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Txt key={i} v="caption" muted style={{ flex: 1, textAlign: "center" }}>
              {WEEKDAYS[(firstWeekday + i) % 7]}
            </Txt>
          ))}
        </Row>
        <View style={{ gap: 8 }}>
          {Array.from({ length: Math.ceil(hist.length / 7) }, (_, row) => (
            <Row key={row} gap={8}>
              {hist.slice(row * 7, row * 7 + 7).map((d) => {
                const r = d.due ? d.kept / d.due : 0;
                const isToday = d.date === localDate();
                return (
                  <View
                    key={d.date}
                    accessibilityLabel={`${d.date}: ${d.kept} of ${d.due}`}
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
          <SectionLabel>Whole-life balance</SectionLabel>
          {stats.categories.map((cat) => (
            <View key={cat.id} style={{ marginBottom: space.lg }}>
              <Row style={{ justifyContent: "space-between", marginBottom: space.sm }}>
                <Row gap={space.sm}>
                  <Icon name={cat.icon} size={16} />
                  <Txt v="heading" style={{ fontSize: 15 }}>
                    {cat.name}
                  </Txt>
                </Row>
                <Txt v="small" muted>
                  {cat.faithfulness === null ? "New" : `${cat.faithfulness}%`}
                </Txt>
              </Row>
              <ProgressBar value={(cat.faithfulness ?? 0) / 100} />
            </View>
          ))}
        </>
      ) : null}

      <Spacer h={space.xl} />
      <Button title="Share my growth" icon="share" variant="secondary" onPress={share} disabled={!stats} />
      <Spacer h={space.sm} />
      <Txt v="small" muted center>
        Shares your growth, never your habit names. Freedom habits are always private.
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
