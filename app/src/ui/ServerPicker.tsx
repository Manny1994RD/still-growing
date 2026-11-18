import { useState } from "react";
import { Pressable } from "react-native";
import { useI18n } from "@/i18n";
import { DEFAULT_API_URL, server } from "@/lib/api";
import { Button, ErrorText, Field, Icon, Row, Sheet, Spacer, Txt } from "./components";
import { space, useTheme } from "./theme";

/**
 * Small "server · Change" link for self-hosting. Lets one app build connect
 * to any Still Growing server.
 */
export function ServerPicker() {
  const { c } = useTheme();
  const { s } = useI18n();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(server.url);
  const [current, setCurrent] = useState(server.url);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(url: string) {
    setError(null);
    setBusy(true);
    try {
      setCurrent(await server.set(url));
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setValue(server.url);
          setOpen(true);
        }}
        style={{ alignSelf: "center", paddingVertical: space.sm }}
      >
        <Row gap={6}>
          <Icon name="server" size={13} color={c.muted} />
          <Txt v="small" muted numberOfLines={1}>
            {current.replace(/^https?:\/\//, "")} · {s.server.change}
          </Txt>
        </Row>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={s.server.title}>
        <Txt muted>{s.server.explain}</Txt>
        <Spacer h={space.lg} />
        <Field
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://growing.example.com/api"
          onSubmitEditing={() => save(value)}
        />
        <ErrorText>{error}</ErrorText>
        <Button title={s.server.connect} onPress={() => save(value)} loading={busy} disabled={!value.trim()} />
        {current !== DEFAULT_API_URL ? (
          <>
            <Spacer h={space.sm} />
            <Button title={s.server.useDefault} variant="ghost" onPress={() => save(DEFAULT_API_URL)} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}
