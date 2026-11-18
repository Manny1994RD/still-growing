import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, serif, space, useTheme } from "./theme";

interface ToastData {
  text: string;
  ref?: string;
  title?: string;
}

const ToastContext = createContext<(t: ToastData) => void>(() => {});

/** Quiet encouragement card that slides up after a check-in. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (t: ToastData) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
      timer.current = setTimeout(hide, t.title ? 5000 : 3800);
    },
    [anim, hide],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 72, alignItems: "center" }}>
          <Animated.View
            style={{
              width: "92%",
              maxWidth: 520,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            }}
          >
            <Pressable
              onPress={hide}
              accessibilityRole="alert"
              style={{ backgroundColor: c.ink, borderRadius: radius.lg, padding: space.lg + 2 }}
            >
              {toast.title ? (
                <Text style={{ color: c.invertInk, fontSize: 13, fontWeight: "700", letterSpacing: 1, marginBottom: 6 }}>
                  {toast.title.toUpperCase()}
                </Text>
              ) : null}
              <Text style={{ color: c.invertInk, fontFamily: serif, fontSize: 16, lineHeight: 23 }}>{toast.text}</Text>
              {toast.ref ? (
                <Text style={{ color: c.invertInk, opacity: 0.6, fontSize: 12, marginTop: 6, letterSpacing: 0.5 }}>{toast.ref}</Text>
              ) : null}
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
