import { Platform, useColorScheme, useWindowDimensions } from "react-native";

/**
 * Monochrome design tokens. Light = ink on paper, dark = paper on ink.
 * Color is used sparingly: one quiet accent for "done" moments.
 */
const light = {
  bg: "#FFFFFF",
  surface: "#F5F5F4",
  elevated: "#FFFFFF",
  ink: "#0A0A0A",
  inkSoft: "#3A3A3A",
  muted: "#8A8A8A",
  hairline: "#E7E7E5",
  invertInk: "#FFFFFF",
  danger: "#B42318",
  overlay: "rgba(0,0,0,0.35)",
};

const dark: typeof light = {
  bg: "#000000",
  surface: "#121212",
  elevated: "#161616",
  ink: "#FAFAFA",
  inkSoft: "#D4D4D4",
  muted: "#7A7A7A",
  hairline: "#262626",
  invertInk: "#0A0A0A",
  danger: "#F97066",
  overlay: "rgba(0,0,0,0.6)",
};

export type Colors = typeof light;

export function useTheme() {
  const scheme = useColorScheme();
  const c = scheme === "dark" ? dark : light;
  return { c, dark: scheme === "dark" };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: "400" as const },
  small: { fontSize: 14, lineHeight: 19, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 1, textTransform: "uppercase" as const },
  number: { fontSize: 40, lineHeight: 44, fontWeight: "700" as const, letterSpacing: -1.2 },
};

/** Tablets, iPad and desktop browsers get a side navigation bar and two-column screens. */
export const WIDE_BREAKPOINT = 768;
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { wide: width >= WIDE_BREAKPOINT, width, height, compact: width < 360 || height < 680 };
}
