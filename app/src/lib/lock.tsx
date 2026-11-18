import * as LocalAuthentication from "expo-local-authentication";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import { useI18n } from "@/i18n";
import { Button, Txt } from "@/ui/components";
import { space, useTheme } from "@/ui/theme";
import { secure } from "./storage";

/**
 * Optional app lock with Face ID / fingerprint / device passcode. When on,
 * the app asks to unlock on launch and whenever it returns after 60 seconds.
 */

const KEY = "still-growing.lock";
const RELOCK_AFTER_MS = 60_000;

interface LockState {
  enabled: boolean;
  available: boolean;
  setEnabled: (on: boolean) => Promise<boolean>;
}
const Ctx = createContext<LockState>({ enabled: false, available: false, setEnabled: async () => false });
export const useAppLock = () => useContext(Ctx);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const { s } = useI18n();
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: s.v5.unlock });
    if (r.success) setLocked(false);
  }, [s.v5.unlock]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setAvailable(ok);
      const on = (await secure.get(KEY)) === "1";
      setEnabledState(on && ok);
      if (on && ok) setLocked(true);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "background") backgroundAt.current = Date.now();
      if (st === "active" && backgroundAt.current && Date.now() - backgroundAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: s.v5.lock });
      if (!r.success) return false;
    }
    await secure.set(KEY, on ? "1" : "0");
    setEnabledState(on);
    return true;
  }, [s.v5.lock]);

  return (
    <Ctx.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {locked ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: space.xl } as object}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.ink, marginBottom: space.xl }} />
          <Txt v="title" center>
            {s.v5.lockedTitle}
          </Txt>
          <View style={{ height: space.xl }} />
          <Button title={s.v5.unlock} icon="unlock" onPress={unlock} />
        </View>
      ) : null}
    </Ctx.Provider>
  );
}
