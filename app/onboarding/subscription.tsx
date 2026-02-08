import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { markOnboardingComplete } from "@/lib/onboarding";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchSubscriptionPlanSummary,
  SubscriptionPlanSummary,
} from "@/services/subscription-settings";
import { fetchSubscriptionSummary } from "@/services/subscriptions";

const FEATURES = [
  "Send unlimited reminders across Gmail, Outlook, Slack, and more.",
  "Manage client conversations across every connected channel from DueSoon.",
];

export default function SubscriptionOnboardingScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const initialLimit =
    typeof user?.subscription?.reminder_limit === "number"
      ? user.subscription.reminder_limit
      : null;
  const [plan, setPlan] = useState<SubscriptionPlanSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [freeLimit, setFreeLimit] = useState<number | null>(initialLimit);
  const [freeLimitLoading, setFreeLimitLoading] = useState(
    initialLimit === null,
  );
  const [limitError, setLimitError] = useState<string | null>(null);

  const finishOnboarding = useCallback(
    async (destination: string = "/(tabs)") => {
      if (user?.id) {
        try {
          await markOnboardingComplete(user.id);
        } catch {
          // ignored
        }
      }
      router.replace(destination);
    },
    [router, user?.id],
  );

  const skipDisabled = freeLimitLoading && freeLimit === null;

  const goToTimezoneStep = useCallback(() => {
    router.replace("/onboarding/timezone");
  }, [router]);

  useEffect(() => {
    if (
      user?.subscription?.is_active ||
      user?.subscription?.is_trialing
    ) {
      finishOnboarding("/(tabs)").catch(() => {});
    }
  }, [
    finishOnboarding,
    user?.subscription?.is_active,
    user?.subscription?.is_trialing,
  ]);

  useEffect(() => {
    let cancelled = false;
    setPlanLoading(true);
    fetchSubscriptionPlanSummary()
      .then((summary) => {
        if (!cancelled) {
          setPlan(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof user?.subscription?.reminder_limit === "number") {
      setFreeLimit(user.subscription.reminder_limit);
      setFreeLimitLoading(false);
    }
  }, [user?.subscription?.reminder_limit]);

  useEffect(() => {
    if (!session?.accessToken || freeLimit !== null) {
      setFreeLimitLoading(false);
      return;
    }
    let cancelled = false;
    setFreeLimitLoading(true);
    fetchSubscriptionSummary(session.accessToken)
      .then((info) => {
        if (cancelled) return;
        const limit =
          typeof info.reminder_limit === "number" ? info.reminder_limit : null;
        setFreeLimit(limit);
        if (limit === null) {
          setLimitError("Unable to load your free reminder quota.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLimitError("Unable to load your free reminder quota.");
          setFreeLimit(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFreeLimitLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [freeLimit, session?.accessToken]);

  const planName = plan?.plan_name ?? "DueSoon Pro";
  const planPrice = plan?.monthly_price
    ? `$${plan.monthly_price.toFixed(2)} / month`
    : "$9.99 / month";
  const planDescription =
    plan?.description ??
    "Unlimited reminders, premium messaging, payment automations, and concierge support.";

  const freeLimitCopy = useMemo(() => {
    if (typeof freeLimit !== "number") {
      return null;
    }
    const unit = freeLimit === 1 ? "reminder" : "reminders";
    return `Your free plan includes ${freeLimit} ${unit} every month.`;
  }, [freeLimit]);

  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    finishOnboarding("/settings").catch(() => {});
  }, [finishOnboarding]);

  const handleSkip = useCallback(() => {
    if (skipDisabled) {
      return;
    }
    Haptics.selectionAsync();
    const proceed = () => {
      finishOnboarding("/(tabs)").catch(() => {});
    };
    if (typeof freeLimit === "number") {
      const unit = freeLimit === 1 ? "reminder" : "reminders";
      Alert.alert(
        "Stay on the free plan",
        `You have ${freeLimit} ${unit} every month.`,
        [
          {
            text: "Continue",
            onPress: proceed,
          },
        ],
        { cancelable: false },
      );
      return;
    }
    proceed();
  }, [freeLimit, finishOnboarding, skipDisabled]);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={goToTimezoneStep}
            style={styles.backButton}
            hitSlop={8}
          >
            <Feather
              name="chevron-left"
              size={16}
              color={Theme.palette.inkMuted}
            />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.stepLabel}>Step 3 of 3</Text>
          <Pressable
            onPress={handleSkip}
            disabled={skipDisabled}
            style={styles.skipButton}
          >
            <Text
              style={[
                styles.skipText,
                skipDisabled && styles.skipTextDisabled,
              ]}
            >
              {skipDisabled ? "Loading..." : "Skip"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.hero}>
          <Text style={styles.title}>Upgrade for unlimited reminders</Text>
          <Text style={styles.subtitle}>
            Unlock every channel, keep automations running, and stay polite but
            persistent without limits.
          </Text>
        </View>
        <View style={styles.planCard}>
          {planLoading ? (
            <View style={styles.planLoadingRow}>
              <ActivityIndicator color={Theme.palette.slate} />
              <Text style={styles.planLoadingText}>Fetching plan...</Text>
            </View>
          ) : null}
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.planPrice}>{planPrice}</Text>
          <Text style={styles.planDescription}>{planDescription}</Text>
        </View>
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View style={styles.featureRow} key={feature}>
              <Feather
                name="check-circle"
                size={18}
                color={Theme.palette.success}
              />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        {limitError ? (
          <Text style={styles.errorText}>{limitError}</Text>
        ) : null}
        {freeLimitCopy ? (
          <View style={styles.freeNote}>
            <Feather
              name="info"
              size={16}
              color={Theme.palette.inkMuted}
            />
            <Text style={styles.freeNoteText}>{freeLimitCopy}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={handleUpgrade}>
            <Text style={styles.primaryButtonText}>Upgrade now</Text>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryButton,
              skipDisabled && styles.secondaryButtonDisabled,
            ]}
            onPress={handleSkip}
            disabled={skipDisabled}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                skipDisabled && styles.secondaryButtonTextDisabled,
              ]}
            >
              Maybe later
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    padding: Theme.spacing.xs,
  },
  backButtonText: {
    fontSize: 14,
    color: Theme.palette.inkMuted,
    fontWeight: "600",
  },
  stepLabel: {
    fontSize: 14,
    color: Theme.palette.inkMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  skipButton: {
    padding: Theme.spacing.xs,
  },
  skipText: {
    fontSize: 14,
    color: Theme.palette.inkMuted,
  },
  skipTextDisabled: {
    color: Theme.palette.border,
  },
  hero: {
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: Theme.palette.surface,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  planLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  planLoadingText: {
    fontSize: 13,
    color: Theme.palette.inkMuted,
  },
  planName: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  planPrice: {
    fontSize: 18,
    color: Theme.palette.ink,
  },
  planDescription: {
    fontSize: 14,
    color: Theme.palette.inkMuted,
    lineHeight: 20,
  },
  features: {
    gap: Theme.spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  featureText: {
    fontSize: 15,
    color: Theme.palette.ink,
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    color: "#C32F27",
  },
  freeNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    padding: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
  },
  freeNoteText: {
    fontSize: 13,
    color: Theme.palette.inkMuted,
    flex: 1,
  },
  actions: {
    gap: Theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: Theme.palette.accent,
    paddingVertical: 16,
    borderRadius: Theme.radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderColor: Theme.palette.border,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: Theme.radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Theme.palette.ink,
    fontSize: 15,
  },
  secondaryButtonDisabled: {
    borderColor: Theme.palette.border,
  },
  secondaryButtonTextDisabled: {
    color: Theme.palette.border,
  },
});
