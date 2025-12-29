import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { paymentLogos } from "@/data/payment-methods";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import {
  PAYMENT_METHODS_CACHE_KEY,
  presentPaymentMethod,
  PaymentMethodListItem,
} from "@/lib/payment-methods";
import { useAuth } from "@/providers/auth-provider";
import { fetchPaymentMethods } from "@/services/payment-methods";
import type { PaymentMethod } from "@/types/payment-methods";

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [methods, setMethods] = useState<PaymentMethodListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromCache = async () => {
      const cached = await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY);
      if (cancelled) {
        return;
      }
      if (cached && cached.length > 0) {
        setMethods(cached.map(presentPaymentMethod));
        setLoading(false);
      }
    };
    hydrateFromCache();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMethods = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!session?.accessToken) {
        setMethods([]);
        setLoading(false);
        if (options?.silent) {
          setRefreshing(false);
        }
        return;
      }
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetchPaymentMethods(session.accessToken);
        await setCachedValue(PAYMENT_METHODS_CACHE_KEY, response);
        setMethods(response.map(presentPaymentMethod));
      } catch (err) {
        console.warn("Failed to load payment methods", err);
        setError(
          err instanceof Error ? err.message : "Unable to load payment methods right now."
        );
        setMethods([]);
      } finally {
        if (options?.silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [session?.accessToken]
  );

  useFocusEffect(
    useCallback(() => {
      loadMethods();
    }, [loadMethods])
  );

  const handleRefresh = useCallback(() => {
    loadMethods({ silent: true });
  }, [loadMethods]);

  const hasMethods = methods.length > 0;

  const methodCards = useMemo(
    () =>
      methods.map((method, index) => (
        <View
          key={method.id}
          style={[
            styles.methodRow,
            index === methods.length - 1 && styles.rowLast,
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
          <Pressable
            style={styles.manageButton}
            onPress={() =>
              router.push({
                pathname: "/settings/payment-methods/[id]",
                params: { id: method.id },
              })
            }
          >
            <Text style={styles.manageButtonText}>Manage</Text>
          </Pressable>
        </View>
      )),
    [methods]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Theme.palette.ink} />
        }
      >
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to settings</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Payment methods</Text>
          <Text style={styles.subtitle}>
            Store bank details, payment links, or crypto wallets so reminders
            can include everything clients need to pay you.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/settings/payment-methods/catalog")}
          >
            <Text style={styles.primaryButtonText}>Add a payment method</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyDetail}>Loading payment methods…</Text>
          </View>
        ) : hasMethods ? (
          <View style={styles.card}>{methodCards}</View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="credit-card" size={28} color={Theme.palette.slate} />
            </View>
            <Text style={styles.emptyTitle}>No payment methods yet</Text>
            <Text style={styles.emptyDetail}>
              Connect Stripe, share bank instructions, or add crypto wallets so
              every reminder finishes with a clear way to pay.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push("/settings/payment-methods/catalog")}
            >
              <Text style={styles.secondaryButtonText}>Browse methods</Text>
            </Pressable>
          </View>
        )}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadMethods()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
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
    gap: Theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
  },
  primaryButton: {
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.ink,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
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
  },
  methodRow: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    gap: Theme.spacing.md,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  methodInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 24,
    height: 24,
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
  manageButton: {
    marginTop: Theme.spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  emptyCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.xl,
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.palette.surface,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.ink,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  errorBanner: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
});
