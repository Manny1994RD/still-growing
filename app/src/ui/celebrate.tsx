import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, View } from "react-native";
import { Button, Icon, Txt } from "./components";
import { radius, serif, space, useTheme } from "./theme";

/** A short check-mark burst in the middle of the screen when a goal is reached. */
const BurstContext = createContext<() => void>(() => {});

export function BurstProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const burst = useCallback(() => {
    setVisible(true);
    scale.setValue(0);
    ring.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 220 }),
        Animated.delay(350),
        Animated.timing(scale, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
      Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [scale, ring]);

  const dots = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

  return (
    <BurstContext.Provider value={burst}>
      {children}
      {visible ? (
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" } as object}>
          <Animated.View
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              borderWidth: 2,
              borderColor: c.ink,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }) }],
            }}
          />
          {dots.map((a, i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: c.ink,
                opacity: ring.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
                transform: [
                  { translateX: ring.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * 110] }) },
                  { translateY: ring.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * 110] }) },
                ],
              }}
            />
          ))}
          <Animated.View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: c.ink,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale }],
            }}
          >
            <Icon name="check" size={52} color={c.invertInk} />
          </Animated.View>
        </View>
      ) : null}
    </BurstContext.Provider>
  );
}

export const useBurst = () => useContext(BurstContext);

/** Centered card for big moments: perfect day, reward reached, new badge. */
export function CenterModal({
  visible,
  onClose,
  emoji,
  title,
  body,
  refText,
  button,
}: {
  visible: boolean;
  onClose: () => void;
  emoji?: string;
  title: string;
  body: string;
  refText?: string;
  button: string;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center", padding: space.xl }}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: c.bg, borderRadius: radius.lg + 4, padding: space.xxl, width: "100%", maxWidth: 420, alignItems: "center" }}
        >
          {emoji ? <Txt style={{ fontSize: 56, lineHeight: 68, marginBottom: space.md }}>{emoji}</Txt> : null}
          <Txt v="title" center>
            {title}
          </Txt>
          <Txt center style={{ fontFamily: serif, fontSize: 18, lineHeight: 26, marginTop: space.md }}>
            {body}
          </Txt>
          {refText ? (
            <Txt v="caption" muted style={{ marginTop: space.md }}>
              {refText}
            </Txt>
          ) : null}
          <View style={{ alignSelf: "stretch", marginTop: space.xl }}>
            <Button title={button} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
