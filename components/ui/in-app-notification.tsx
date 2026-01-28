import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";

type Props = {
  title: string;
  body?: string;
  visible: boolean;
  onPress?: () => void;
  onDismiss?: () => void;
};

const AUTO_HIDE_MS = 6000;
const AnimatedView = Animated.View;

export function InAppNotificationBanner({
  title,
  body,
  visible,
  onPress,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      timerRef.current = setTimeout(() => {
        onDismiss?.();
      }, AUTO_HIDE_MS);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -150,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, onDismiss, opacity, translateY]);

  const topOffset =
    (Platform.OS === "android" ? insets.top + Theme.spacing.md : insets.top) +
    Theme.spacing.md;

  return (
    <AnimatedView
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.container,
        {
          top: topOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.banner}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {body ? (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onDismiss?.();
          }}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Feather name="x" size={16} color={Theme.palette.inkMuted} />
        </Pressable>
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  banner: {
    backgroundColor: Theme.palette.surface,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  textContainer: {
    flex: 1,
    paddingRight: Theme.spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  body: {
    fontSize: 14,
    color: Theme.palette.inkMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
});
