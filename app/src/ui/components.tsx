import Feather from "@expo/vector-icons/Feather";
import { type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ColorValue,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, serif, space, type as t, useTheme } from "./theme";

export type IconName = ComponentProps<typeof Feather>["name"];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: ColorValue }) {
  const { c } = useTheme();
  const valid = (Feather.glyphMap as Record<string, number>)[name] !== undefined;
  return <Feather name={(valid ? name : "circle") as IconName} size={size} color={(color as string | undefined) ?? c.ink} />;
}

// ---------- layout ----------
export function Screen({
  children,
  scroll = true,
  edges = ["top"],
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom")[];
  padded?: boolean;
}) {
  const { c } = useTheme();
  const inner = <View style={[styles.column, padded && { paddingHorizontal: space.xl }]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: space.xxxl * 2, paddingTop: space.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingTop: space.lg }}>{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />;
}

// ---------- text ----------
type Variant = keyof typeof t;
export function Txt({
  children,
  v = "body",
  muted,
  center,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  v?: Variant;
  muted?: boolean;
  center?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[t[v], { color: muted ? c.muted : c.ink }, center && { textAlign: "center" }, style]}
    >
      {children}
    </Text>
  );
}

export function Verse({ text, refText }: { text: string; refText?: string }) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={{ fontFamily: serif, fontSize: 19, lineHeight: 28, color: c.ink, fontStyle: "italic" }}>“{text}”</Text>
      {refText ? (
        <Txt v="caption" muted style={{ marginTop: space.md }}>
          {refText}
        </Txt>
      ) : null}
    </View>
  );
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Txt v="caption" muted style={{ marginBottom: space.sm }}>
              {eyebrow}
            </Txt>
          ) : null}
          <Txt v="display">{title}</Txt>
        </View>
        {right}
      </Row>
    </View>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: space.xxl, marginBottom: space.md }}>
      <Txt v="caption" muted>
        {children}
      </Txt>
      {right}
    </Row>
  );
}

// ---------- controls ----------
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  small?: boolean;
}) {
  const { c } = useTheme();
  const bg = variant === "primary" ? c.ink : variant === "secondary" ? c.surface : "transparent";
  const fg = variant === "primary" ? c.invertInk : variant === "danger" ? c.danger : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          height: small ? 40 : 54,
          paddingHorizontal: small ? space.lg : space.xl,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.sm,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: "600" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label }: { name: string; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: c.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} size={20} />
    </Pressable>
  );
}

export function Field({ label, hint, style, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? (
        <Txt v="caption" muted style={{ marginBottom: space.sm }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={c.muted}
        style={[
          {
            backgroundColor: c.surface,
            color: c.ink,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: props.multiline ? space.md : 0,
            minHeight: 52,
            fontSize: 16,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          style,
        ]}
        {...props}
      />
      {hint ? (
        <Txt v="small" muted style={{ marginTop: space.xs }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.hairline,
        backgroundColor: selected ? c.ink : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? c.invertInk : c.ink} /> : null}
      <Text style={{ color: selected ? c.invertInk : c.ink, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl }, style]}>{children}</View>;
}

export function ProgressBar({ value, height = 4 }: { value: number; height?: number }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.hairline, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: c.ink, borderRadius: height }} />
    </View>
  );
}

export function Check({ state, size = 30 }: { state: "empty" | "partial" | "done" | "slipped" | "rest"; size?: number }) {
  const { c } = useTheme();
  const filled = state === "done" || state === "rest";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: state === "empty" ? c.muted : c.ink,
        backgroundColor: filled ? c.ink : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {state === "done" ? <Icon name="check" size={size * 0.55} color={c.invertInk} /> : null}
      {state === "rest" ? <Icon name="moon" size={size * 0.45} color={c.invertInk} /> : null}
      {state === "slipped" ? <Icon name="rotate-ccw" size={size * 0.45} /> : null}
      {state === "partial" ? <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: c.ink }} /> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.md, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? c.elevated : "transparent",
              ...(on ? styles.shadow : null),
            }}
          >
            <Text style={{ color: on ? c.ink : c.muted, fontWeight: on ? "600" : "500", fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.lg + 4,
            borderTopRightRadius: radius.lg + 4,
            padding: space.xl,
            paddingBottom: space.xxxl,
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
          }}
        >
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.hairline, marginBottom: space.lg }} />
          {title ? (
            <Txt v="title" style={{ marginBottom: space.lg }}>
              {title}
            </Txt>
          ) : null}
          <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.72 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetAction({ label, icon, onPress, danger }: { label: string; icon: string; onPress: () => void; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg, opacity: pressed ? 0.5 : 1 })}
    >
      <Icon name={icon} color={danger ? c.danger : c.ink} />
      <Text style={{ fontSize: 16, color: danger ? c.danger : c.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={c.ink} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const { c } = useTheme();
  if (!children) return null;
  return <Text style={{ color: c.danger, fontSize: 14, marginBottom: space.md }}>{children}</Text>;
}

const styles = StyleSheet.create({
  column: { width: "100%", maxWidth: 560, alignSelf: "center" },
  shadow: Platform.select({
    web: { boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } as object,
    default: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  })!,
});
