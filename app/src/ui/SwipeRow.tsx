import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Icon } from "./components";
import { radius, useTheme } from "./theme";

const THRESHOLD = 90;

/**
 * Swipe a row to the right to complete it. Only horizontal drags are taken,
 * so vertical scrolling and taps keep working normally.
 */
export function SwipeRow({ children, onSwipe, enabled = true }: { children: ReactNode; onSwipe: () => void; enabled?: boolean }) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(0)).current;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => enabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(g.dx, 160))),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > THRESHOLD) onSwipeRef.current();
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const revealOpacity = x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <View style={{ position: "relative" }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          right: 0,
          borderRadius: radius.md,
          backgroundColor: c.ink,
          opacity: revealOpacity,
          justifyContent: "center",
          paddingLeft: 18,
        }}
      >
        <Icon name="check" color={c.invertInk} size={22} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: c.bg }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
