import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import type { Season } from "@/lib/types";
import { useTheme } from "./theme";

/**
 * The growing plant: its shape follows your Growth Season (seed → overflowing)
 * and the water in the soil shows how much of today you've completed.
 */
export function Plant({ season, water, size = 180 }: { season: Season; water: number; size?: number }) {
  const { c } = useTheme();
  const ink = c.ink;
  const soft = c.hairline;
  const w = Math.max(0, Math.min(1, water));
  const stage = ["seed", "sprout", "rooted", "fruitful", "overflowing"].indexOf(season);

  const leaf = (x: number, y: number, rot: number, s = 1) => (
    <Ellipse key={`${x}-${y}-${rot}`} cx={x} cy={y} rx={14 * s} ry={6.5 * s} fill={ink} transform={`rotate(${rot} ${x} ${y})`} />
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel={`Plant: ${season}`}>
      {/* soil with water level */}
      <Rect x="40" y="160" width="120" height="22" rx="11" fill={soft} />
      <Rect x="40" y="160" width={120 * w} height="22" rx="11" fill={ink} opacity={0.25 + w * 0.5} />
      {/* pot rim */}
      <Line x1="34" y1="160" x2="166" y2="160" stroke={ink} strokeWidth="3" strokeLinecap="round" />

      {stage === 0 ? (
        <G>
          {/* a seed with its first tiny shoot */}
          <Ellipse cx="100" cy="154" rx="10" ry="6" fill={ink} />
          <Path d="M100 150 C100 144, 101 138, 100 132" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          {leaf(92, 130, -30, 0.6)}
          {leaf(108, 130, 30, 0.6)}
        </G>
      ) : null}

      {stage >= 1 ? (
        <G>
          <Path
            d={`M100 160 C100 ${150 - stage * 6}, 100 ${130 - stage * 14}, 100 ${120 - stage * 18}`}
            stroke={ink}
            strokeWidth={3 + stage * 0.8}
            strokeLinecap="round"
            fill="none"
          />
          {leaf(88, 138, -30)}
          {leaf(112, 138, 30)}
        </G>
      ) : null}

      {stage >= 2 ? (
        <G>
          {leaf(86, 112, -35, 1.15)}
          {leaf(114, 104, 35, 1.15)}
          {leaf(86, 88, -40, 1.05)}
        </G>
      ) : null}

      {stage >= 3 ? (
        <G>
          {leaf(114, 78, 40, 1.1)}
          {leaf(90, 62, -40, 1)}
          <Circle cx="76" cy="100" r="6" fill={ink} />
          <Circle cx="125" cy="90" r="6" fill={ink} />
        </G>
      ) : null}

      {stage >= 4 ? (
        <G>
          {leaf(112, 52, 45, 0.95)}
          <Circle cx="100" cy="36" r="12" fill="none" stroke={ink} strokeWidth="3" />
          <Circle cx="100" cy="36" r="4" fill={ink} />
          <Circle cx="70" cy="74" r="5" fill={ink} />
          <Circle cx="132" cy="64" r="5" fill={ink} />
        </G>
      ) : null}
    </Svg>
  );
}
