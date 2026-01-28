import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";

type WelcomeSlide = {
  key: string;
  title: string;
  caption: string;
  image?: ImageSourcePropType;
  redirect?: boolean;
};

const SLIDES: WelcomeSlide[] = [
  {
    key: "pipeline",
    title: "Send reminders anywhere",
    caption:
      "Send reminders via Gmail, Outlook, WhatsApp, Telegram, and Slack from one app.",
    image: require("@/assets/welcomeScreens/step1.png"),
  },
  {
    key: "nudges",
    title: "Choose the tone",
    caption:
      "Choose between Gentle, Neutral, and Firm tones to keep relationships healthy.",
    image: require("@/assets/welcomeScreens/step2.png"),
  },
  {
    key: "collect",
    title: "Prep once, let DueSoon send",
    caption: "Enter details, choose timing, and pick a platform.",
    image: require("@/assets/welcomeScreens/step3.png"),
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<WelcomeSlide> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const slideWidth = useMemo(() => {
    const paddedWidth = width - Theme.spacing.lg * 2;
    return Math.max(Math.min(paddedWidth, 520), 280);
  }, [width]);
  const slides = useMemo<WelcomeSlide[]>(
    () => [...SLIDES, { key: "redirect", title: "", caption: "", redirect: true }],
    [],
  );
  const redirectTriggered = useRef(false);

  const goToLogin = useCallback(() => {
    Haptics.selectionAsync();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (activeIndex >= SLIDES.length && !redirectTriggered.current) {
      redirectTriggered.current = true;
      goToLogin();
    }
  }, [activeIndex, goToLogin]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!slideWidth) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / slideWidth);
      setActiveIndex(nextIndex);
    },
    [slideWidth],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={goToLogin} hitSlop={8}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.carouselWrapper}>
          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              item.redirect ? (
                <View style={{ width: slideWidth }} />
              ) : (
                <View style={[styles.slide, { width: slideWidth }]}>
                  {item.image ? (
                    <Image
                      source={item.image}
                      style={styles.slideImage}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={styles.slideText}>
                    <Text style={styles.slideTitle}>{item.title}</Text>
                    <Text style={styles.slideCaption}>{item.caption}</Text>
                  </View>
                </View>
              )
            )}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            getItemLayout={getItemLayout}
            decelerationRate="fast"
            snapToAlignment="start"
            style={{ width: slideWidth }}
          />
        </View>

        <View style={styles.pagination}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                index === Math.min(activeIndex, SLIDES.length - 1) && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.xl,
  },
  topRow: {
    width: "100%",
    alignItems: "flex-end",
  },
  skipLabel: {
    fontSize: 16,
    color: Theme.palette.inkMuted,
  },
  carouselWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.lg,
  },
  slideImage: {
    width: "100%",
    height: 460,
  },
  slideText: {
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: "500",
    color: Theme.palette.ink,
    textAlign: "center",
  },
  slideCaption: {
    fontSize: 16,
    color: Theme.palette.inkMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Theme.spacing.xs,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.palette.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: Theme.palette.ink,
  },
});
