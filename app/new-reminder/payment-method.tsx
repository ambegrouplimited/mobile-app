import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { paymentLogos } from "@/data/payment-methods";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import {
  PAYMENT_METHODS_CACHE_KEY,
  findVariantByType,
  presentPaymentMethod,
  type PaymentMethodListItem,
} from "@/lib/payment-methods";
import { useAuth } from "@/providers/auth-provider";
import { fetchPaymentMethods } from "@/services/payment-methods";
import type { PaymentMethod } from "@/types/payment-methods";

export default function ReminderPaymentMethodScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [items, setItems] = useState<PaymentMethodListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(persistedParams.paymentMethodId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const loadCached = useCallback(async () => {
    const cached = await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY);
    if (cached && cached.length > 0) {
      setMethods(cached);
      setItems(cached.map(presentPaymentMethod));
      setLoading(false);
    }
  }, []);

  const loadMethods = useCallback(async () => {
    if (!session?.accessToken) {
      setMethods([]);
      setItems([]);
      setLoading(false);
      setError("Sign in again to select a payment method.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentMethods(session.accessToken);
      setMethods(response);
      setItems(response.map(presentPaymentMethod));
      await setCachedValue(PAYMENT_METHODS_CACHE_KEY, response);
      if (response.length > 0) {
        setSelectedId((prev) => prev || response[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load payment methods right now.",
      );
      setMethods([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useFocusEffect(
    useCallback(() => {
      loadCached();
      loadMethods();
    }, [loadCached, loadMethods]),
  );

  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === selectedId) ?? null,
    [methods, selectedId],
  );

  const handleContinue = async () => {
    if (!selectedMethod) {
      setError("Select a payment method to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await Haptics.selectionAsync();
      const summaryPayload = buildPaymentSummary(selectedMethod);
      router.push({
        pathname: "/new-reminder/schedule",
        params: {
          ...persistedParams,
          paymentMethodId: selectedMethod.id,
          payment: JSON.stringify(summaryPayload),
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderMethods = () => {
    if (loading) {
      return (
        <View style={styles.card}>
          <Text style={styles.loadingText}>Loading payment methods…</Text>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Feather name="credit-card" size={28} color={Theme.palette.slate} />
          <Text style={styles.emptyTitle}>No payment methods yet</Text>
          <Text style={styles.emptyDetail}>
            Add a payment method to attach clear payment instructions to this reminder.
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/settings/payment-methods/catalog")}
          >
            <Text style={styles.secondaryButtonText}>Add a payment method</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        {items.map((method, index) => {
          const active = method.id === selectedId;
          return (
            <Pressable
              key={method.id}
              onPress={() => setSelectedId(method.id)}
              style={[
                styles.methodRow,
                index === items.length - 1 && styles.rowLast,
                active && styles.methodRowActive,
              ]}
            >
              <View style={styles.methodInfo}>
                <View style={styles.logoWrap}>
                  <Image
                    source={{ uri: paymentLogos[method.logo] }}
                    style={styles.logo}
                    contentFit="contain"
                  />
                </View>
                <View style={styles.methodText}>
                  <Text style={styles.methodLabel}>{method.title}</Text>
                  <Text style={styles.methodDetail}>{method.detail}</Text>
                </View>
              </View>
              <View style={styles.radioOuter}>{active ? <View style={styles.radioInner} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Delivery settings</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Attach a payment method</Text>
          <Text style={styles.subtitle}>
            Reuse the payment methods you already saved so every reminder shares the right instructions.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/settings/payment-methods/catalog")}
          >
            <Text style={styles.primaryButtonText}>Add a payment method</Text>
          </Pressable>
        </View>

        {renderMethods()}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.continueButton, (!selectedMethod || submitting) && styles.continueButtonDisabled]}
          disabled={!selectedMethod || submitting}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>{submitting ? "Saving..." : "Use this payment method"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildPaymentSummary(method: PaymentMethod) {
  const meta = findVariantByType(method.type);
  const presented = presentPaymentMethod(method);
  return {
    methodTitle: presented.title,
    variantLabel: meta?.variant.label ?? presented.title,
    fields: [{ label: "Details", value: presented.detail }],
  };
}

function normalizeParams(params: Record<string, string | string[]>) {
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value[0] ?? "";
    } else if (typeof value === "string") {
      result[key] = value;
    }
  });
  return result;
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
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  header: {
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  primaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: Theme.palette.border,
  },
  methodRowActive: {
    backgroundColor: "rgba(77, 94, 114, 0.08)",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  methodInfo: {
    flexDirection: "row",
    gap: Theme.spacing.md,
    alignItems: "center",
    flex: 1,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.surface,
  },
  logo: {
    width: 32,
    height: 32,
  },
  methodText: {
    flex: 1,
    gap: 2,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  methodDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.palette.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.palette.slate,
  },
  loadingText: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  emptyCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: "center",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  emptyDetail: {
    fontSize: 14,
    color: Theme.palette.slate,
    textAlign: "center",
  },
  secondaryButton: {
    marginTop: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  errorBanner: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.accent,
    padding: Theme.spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Theme.palette.accent,
  },
  continueButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
