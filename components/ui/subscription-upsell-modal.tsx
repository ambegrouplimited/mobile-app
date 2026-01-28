import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Theme } from "@/constants/theme";
import {
  closeSubscriptionUpsell,
  getCachedPlanSummary,
  getSubscriptionUpsellState,
  setCachedPlanSummary,
  subscribeToPlanSummaryUpdates,
  subscribeToSubscriptionUpsell,
} from "@/lib/subscription-upsell";
import {
  fetchSubscriptionPlanSummary,
  SubscriptionPlanSummary,
} from "@/services/subscription-settings";

type UpsellModalState = {
  open: boolean;
  message?: string;
};

export function SubscriptionUpsellModal() {
  const router = useRouter();
  const [state, setState] = useState<UpsellModalState>(
    getSubscriptionUpsellState(),
  );
  const [plan, setPlan] = useState<SubscriptionPlanSummary | null>(getCachedPlanSummary());
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    const unsubUpsell = subscribeToSubscriptionUpsell((next) => {
      setState(next);
    });
    const unsubPlan = subscribeToPlanSummaryUpdates((summary) => {
      setPlan(summary);
    });
    return () => {
      unsubUpsell();
      unsubPlan();
    };
  }, []);

  useEffect(() => {
    if (!state.open) {
      return;
    }
    const cached = getCachedPlanSummary();
    if (cached && !plan) {
      setPlan(cached);
    }
  }, [state.open, plan]);

  useEffect(() => {
    let cancelled = false;
    if (!state.open || planLoading) {
      return () => {
        cancelled = true;
      };
    }
    if (plan) {
      return () => {
        cancelled = true;
      };
    }
    setPlanLoading(true);
    fetchSubscriptionPlanSummary()
      .then((summary) => {
        console.log("SubscriptionUpsellModal: fetched plan", summary);
        setCachedPlanSummary(summary);
        if (!cancelled) {
          setPlan(summary);
        }
      })
      .catch((err) => {
        console.warn("SubscriptionUpsellModal: plan fetch failed", err);
        if (!cancelled) {
          setPlan(null);
        }
      })
      .finally(() => {
        setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.open, plan, planLoading]);

  if (!state.open) {
    return null;
  }

  const planName = plan?.plan_name ?? (planLoading ? "Loading plan…" : "Pro plan");
  const planPrice = plan
    ? `$${plan.monthly_price.toFixed(2)} / month`
    : planLoading
      ? "Updating price…"
      : "$9.99 / month";
  console.log("SubscriptionUpsellModal: rendering", {
    planName,
    planPrice,
    hasPlan: Boolean(plan),
  });
  const goToPlans = () => {
    closeSubscriptionUpsell();
    router.push("/settings");
  };

  const titleText = state.headline
    ? state.headline
    : state.message
      ? "Upgrade to unlock this"
      : "Unlock DueSoon Pro";
  const bodyText = state.message
    ? state.message
    : `Join the ${planName} to send unlimited reminders, access messaging across Gmail, Slack, WhatsApp, and keep your automations running without limits.`;

  return (
    <Modal
      transparent
      visible={state.open}
      animationType="slide"
      onRequestClose={closeSubscriptionUpsell}
    >
      <Pressable style={styles.overlay} onPress={closeSubscriptionUpsell}>
        <View style={styles.backdrop} />
      </Pressable>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.header}>
          <Feather name="zap" size={22} color={Theme.palette.slate} />
          <Text style={styles.title}>{titleText}</Text>
        </View>
        <Text style={styles.message}>{bodyText}</Text>
        <View style={styles.planCard}>
          {planLoading ? (
            <View style={styles.planLoadingRow}>
              <ActivityIndicator color={Theme.palette.slate} />
              <Text style={styles.planLoadingText}>Fetching latest plan…</Text>
            </View>
          ) : null}
          <Text style={styles.planTitle}>{planName}</Text>
          <Text style={styles.planPrice}>{planPrice}</Text>
          <Text style={styles.planSubtitle}>
            {plan?.description ??
              "Unlimited reminders, messaging access, payment automations, and premium integrations."}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={closeSubscriptionUpsell}
          >
            <Text style={styles.secondaryButtonLabel}>Maybe later</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={goToPlans}>
            <Text style={styles.primaryButtonLabel}>Join now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
    borderTopLeftRadius: Theme.radii.lg,
    borderTopRightRadius: Theme.radii.lg,
    gap: Theme.spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.palette.border,
    marginBottom: Theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.palette.ink,
  },
  message: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  planCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    backgroundColor: Theme.palette.surface,
    gap: 4,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: Theme.palette.ink,
  },
  planSubtitle: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  planLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  planLoadingText: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  actions: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
  },
  secondaryButtonLabel: {
    fontSize: 15,
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
    backgroundColor: Theme.palette.ink,
  },
  primaryButtonLabel: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
