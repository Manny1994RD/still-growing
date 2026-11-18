import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { createElement, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useI18n } from "@/i18n";
import { formatTime } from "@/lib/date";
import { Button, Icon, Row, Sheet, Txt } from "./components";
import { radius, space, useTheme } from "./theme";

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (t: string | null) => {
  const d = new Date();
  const [h, m] = (t ?? "08:00").split(":").map(Number);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
};
const fromDate = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Time selector: the phone's native clock picker on Android/iOS and the
 * browser's time input on web. Value is "HH:MM" (24h) or null when optional.
 */
export function TimeField({
  label,
  value,
  onChange,
  optional,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  optional?: boolean;
}) {
  const { c } = useTheme();
  const { s, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toDate(value));

  const box = {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    justifyContent: "center" as const,
  };

  const display = value ? formatTime(value, locale) : s.time.none;

  let control;
  if (Platform.OS === "web") {
    control = (
      <View style={[box, { flexDirection: "row", alignItems: "center" }]}>
        {createElement("input", {
          type: "time",
          value: value ?? "",
          onChange: (e: { target: { value: string } }) => onChange(e.target.value || (optional ? null : value)),
          "aria-label": label,
          style: {
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: c.ink,
            fontSize: 16,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            colorScheme: "light dark",
            minHeight: 50,
          },
        })}
      </View>
    );
  } else {
    const openPicker = () => {
      if (Platform.OS === "android") {
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: "time",
          is24Hour: false,
          onValueChange: (_e, d) => onChange(fromDate(d)),
        });
      } else {
        setDraft(toDate(value));
        setOpen(true);
      }
    };
    control = (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ""} ${display}`} onPress={openPicker} style={({ pressed }) => [box, { opacity: pressed ? 0.7 : 1 }]}>
        <Row gap={space.sm}>
          <Icon name="clock" size={16} color={c.muted} />
          <Txt style={{ fontSize: 16, color: value ? c.ink : c.muted }}>{display}</Txt>
        </Row>
      </Pressable>
    );
  }

  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? (
        <Txt v="caption" muted style={{ marginBottom: space.sm }}>
          {label}
        </Txt>
      ) : null}
      {control}
      {optional && value ? (
        <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ marginTop: space.xs, alignSelf: "flex-start" }}>
          <Txt v="small" muted>
            {s.time.remove}
          </Txt>
        </Pressable>
      ) : null}
      {Platform.OS === "ios" ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
          <View style={{ alignItems: "center" }}>
            <DateTimePicker value={draft} mode="time" display="spinner" onValueChange={(_e, d) => setDraft(d)} />
          </View>
          <Button
            title={s.time.done}
            onPress={() => {
              onChange(fromDate(draft));
              setOpen(false);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
