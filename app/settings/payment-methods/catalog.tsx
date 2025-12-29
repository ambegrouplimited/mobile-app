import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import PaymentMethodComposer, {
  PaymentMethodSelection,
} from "@/components/payment/PaymentMethodComposer";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { PAYMENT_METHODS_CACHE_KEY, selectionToPayload } from "@/lib/payment-methods";
import { useAuth } from "@/providers/auth-provider";
import { createPaymentMethod } from "@/services/payment-methods";
import type { PaymentMethod } from "@/types/payment-methods";

export default function PaymentMethodCatalogScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSave = async (selection: PaymentMethodSelection) => {
    if (!session?.accessToken) {
      Alert.alert("Not signed in", "Sign in again to add a payment method.");
      return;
    }
    setSaving(true);
    try {
      const payload = selectionToPayload(selection);
      const created = await createPaymentMethod(payload, session.accessToken);
      const cached = (await getCachedValue<PaymentMethod[]>(PAYMENT_METHODS_CACHE_KEY)) ?? [];
      const nextCache = [created, ...cached.filter((method) => method.id !== created.id)];
      await setCachedValue(PAYMENT_METHODS_CACHE_KEY, nextCache);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", `${selection.method.title} was added.`);
      router.back();
    } catch (err) {
      Alert.alert(
        "Unable to save",
        err instanceof Error
          ? err.message
          : "Unable to save this payment method right now."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PaymentMethodComposer
      backLabel="Payment methods"
      title="Configure a payment method"
      subtitle="Choose a method, fill in the details, and we’ll reuse it across reminders."
      onBack={() => router.back()}
      onSubmit={handleSave}
      submitting={saving}
      primaryButtonLabel={() =>
        saving ? "Saving..." : "Save payment method"
      }
    />
  );
}
