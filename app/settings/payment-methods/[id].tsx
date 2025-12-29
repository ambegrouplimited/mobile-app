import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import PaymentMethodComposer, {
  PaymentMethodSelection,
} from "@/components/payment/PaymentMethodComposer";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import {
  PAYMENT_METHODS_CACHE_KEY,
  buildComposerInitialState,
  selectionToPayload,
} from "@/lib/payment-methods";
import { useAuth } from "@/providers/auth-provider";
import {
  deletePaymentMethod,
  fetchPaymentMethodDetails,
  updatePaymentMethod,
} from "@/services/payment-methods";
import type { PaymentMethod } from "@/types/payment-methods";

export default function ManagePaymentMethodScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const methodId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheUpsert = useCallback(async (next: PaymentMethod) => {
    const cached = (await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY)) ?? [];
    const updated = [next, ...cached.filter((item) => item.id !== next.id)];
    await setCachedValue(PAYMENT_METHODS_CACHE_KEY, updated);
  }, []);

  const cacheRemove = useCallback(async (idToRemove: string) => {
    const cached = (await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY)) ?? [];
    const updated = cached.filter((item) => item.id !== idToRemove);
    await setCachedValue(PAYMENT_METHODS_CACHE_KEY, updated);
  }, []);

  const loadMethod = useCallback(async () => {
    if (!methodId) {
      setError("Missing payment method reference.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cached = (await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY)) ?? [];
      const cachedRecord = cached.find((item) => item.id === methodId);
      if (cachedRecord) {
        setMethod(cachedRecord);
      }
      if (!session?.accessToken) {
        setLoading(false);
        return;
      }
      const remote = await fetchPaymentMethodDetails(methodId, session.accessToken);
      setMethod(remote);
    } catch (err) {
      console.warn("Failed to load payment method", err);
      setError(
        err instanceof Error ? err.message : "Unable to load this payment method right now."
      );
    } finally {
      setLoading(false);
    }
  }, [methodId, session?.accessToken]);

  useEffect(() => {
    loadMethod();
  }, [loadMethod]);

  const initialState = useMemo(() => (method ? buildComposerInitialState(method) : null), [method]);

  const handleSave = useCallback(
    async (selection: PaymentMethodSelection) => {
      if (!methodId || !session?.accessToken) {
        Alert.alert("Not signed in", "Sign back in to update this payment method.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const payload = selectionToPayload(selection);
        const updated = await updatePaymentMethod(methodId, payload, session.accessToken);
        await cacheUpsert(updated);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } catch (err) {
        console.warn("Failed to update payment method", err);
        Alert.alert(
          "Unable to save",
          err instanceof Error ? err.message : "Unable to update this payment method."
        );
      } finally {
        setSaving(false);
      }
    },
    [cacheUpsert, methodId, router, session?.accessToken]
  );

  const confirmDelete = useCallback(() => {
    if (!methodId || !session?.accessToken) {
      Alert.alert("Not signed in", "Sign back in to delete this payment method.");
      return;
    }
    Alert.alert(
      "Delete payment method",
      "This will remove the method from saved reminders. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePaymentMethod(methodId, session.accessToken);
              await cacheRemove(methodId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              router.back();
            } catch (err) {
              console.warn("Failed to delete payment method", err);
              Alert.alert(
                "Unable to delete",
                err instanceof Error ? err.message : "Unable to delete this payment method."
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [cacheRemove, methodId, router, session?.accessToken]);

  if (loading && !initialState) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Theme.palette.ink} />
        <Text style={styles.loaderText}>Loading payment method…</Text>
      </View>
    );
  }

  if (!methodId || !initialState) {
    return (
      <View style={styles.loader}>
        <Text style={styles.loaderText}>
          {error ?? "We couldn’t find this payment method."}
        </Text>
        <Pressable style={styles.retryButton} onPress={loadMethod}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PaymentMethodComposer
      backLabel="Payment methods"
      title="Edit payment method"
      subtitle="Update the details or switch to another payment option."
      onBack={() => router.back()}
      onSubmit={handleSave}
      submitting={saving}
      primaryButtonLabel={() => (saving ? "Saving..." : "Save changes")}
      initialMethodId={initialState.methodId}
      initialVariantId={initialState.variantId}
      initialFormValues={initialState.formValues}
      footerSlot={
        <View style={styles.footer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            disabled={deleting}
            onPress={confirmDelete}
          >
            <Text style={styles.deleteButtonText}>
              {deleting ? "Deleting…" : "Delete payment method"}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.background,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  loaderText: {
    fontSize: 15,
    color: Theme.palette.slate,
    textAlign: "center",
  },
  retryButton: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  footer: {
    gap: Theme.spacing.md,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
  },
  deleteButton: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
});
