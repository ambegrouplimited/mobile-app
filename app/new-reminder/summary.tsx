import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { ReminderSummaryDetails } from "@/components/reminder-summary";
import { ReminderSummaryData } from "@/types/reminders";
import { useAuth } from "@/providers/auth-provider";
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";
import { createInvoice } from "@/services/invoices";
import { deleteReminderDraft } from "@/services/reminder-drafts";
import type { DeliveryChannel, InvoiceCreatePayload, ReminderSchedulePayload } from "@/types/invoices";

export default function SummaryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const params = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const draftId = params.draftId ?? null;
  const draftParams = useMemo(() => {
    const next = { ...params };
    delete next.draftId;
    return next;
  }, [params]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const paymentInfo = useMemo(() => parseJSON(params.payment), [params.payment]);
  const scheduleMode = (params.scheduleMode as ReminderSummaryData["schedule"]["mode"]) ?? "manual";
  const scheduleInfo = useMemo(() => parseJSON(params.scheduleSummary), [params.scheduleSummary]);

  const summaryData: ReminderSummaryData = {
    client: {
      name: params.client || "Not provided",
      type: params.clientType ?? "Not set",
      businessName: params.businessName,
      amount: params.amount || "Not provided",
      dueDate: params.dueDate,
    },
    contact: {
      platform: (params.platform as string) ?? "Selected platform",
      dispatchMode: params.mode === "self" ? "self" : "assist",
      value: params.contact ?? "Not provided",
    },
    payment: paymentInfo
      ? {
          methodTitle: paymentInfo.methodTitle ?? "—",
          variantLabel: paymentInfo.variantLabel ?? "—",
          fields: paymentInfo.fields,
        }
      : null,
    schedule: {
      mode: scheduleMode,
      data: scheduleInfo ?? undefined,
    },
  };

  useReminderDraftPersistor({
    token: session?.accessToken ?? null,
    draftId,
    params: draftParams,
    metadata: {
      client_name: params.client || "New reminder",
      amount_display: params.amount || null,
      status: "Ready to send",
      next_action: "Finish scheduling when you're ready.",
    },
    lastStep: "summary",
    lastPath: "/new-reminder/summary",
    enabled: Boolean(session?.accessToken && draftId),
  });
  const handleReturnToReminders = () => {
    router.replace("/reminders");
  };
  const handleBack = () => {
    if (draftId) {
      router.push({
        pathname: "/new-reminder/schedule",
        params: {
          ...draftParams,
          ...(draftId ? { draftId } : {}),
        },
      });
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navRow}>
          <Pressable style={styles.backLink} onPress={handleBack} hitSlop={8}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Edit schedule</Text>
          </Pressable>
          {draftId ? (
            <Pressable style={styles.remindersLink} onPress={handleReturnToReminders}>
              <Feather name="home" size={18} color={Theme.palette.slate} />
              <Text style={styles.remindersLabel}>Reminders</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Reminder summary</Text>
          <Text style={styles.subtitle}>
            Review the details we’ll use for this reminder before returning to the dashboard.
          </Text>
        </View>

        <ReminderSummaryDetails data={summaryData} />

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          disabled={submitting}
          onPress={async () => {
            await Haptics.selectionAsync();
            handleSubmit({
              params,
              scheduleMode,
              scheduleInfo,
              sessionToken: session?.accessToken ?? null,
              draftId,
              setError: setSubmitError,
              setSubmitting,
              router,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Creating invoice..." : "Finish"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

async function handleSubmit({
  params,
  scheduleMode,
  scheduleInfo,
  sessionToken,
  draftId,
  setError,
  setSubmitting,
  router,
}: {
  params: Record<string, string>;
  scheduleMode: ReminderSummaryData["schedule"]["mode"];
  scheduleInfo: unknown;
  sessionToken: string | null;
  draftId?: string | null;
  setError: (value: string | null) => void;
  setSubmitting: (value: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (!sessionToken) {
    setError("Please sign in again to create this invoice.");
    return;
  }
  if (!params.clientId || !params.contactMethodId) {
    setError("Missing client details. Go back and confirm the contact information.");
    return;
  }
  if (!params.paymentMethodId) {
    setError("Pick a payment method before finishing.");
    return;
  }
  const amountValue = parseAmount(params.amount);
  if (!amountValue) {
    setError("Enter a valid amount before scheduling.");
    return;
  }
  const schedulePayload = buildSchedulePayload(scheduleMode, scheduleInfo);
  if (!schedulePayload) {
    setError("Add at least one schedule entry before sending.");
    return;
  }

  const payload: InvoiceCreatePayload = {
    client_id: params.clientId,
    contact_method_id: params.contactMethodId,
    amount: amountValue,
    currency: "USD",
    description: params.notes || null,
    due_date: params.dueDate ? formatDueDateTimestamp(params.dueDate) : null,
    send_via: resolveDeliveryChannel(params.platform, params.mode),
    reminder_schedule: schedulePayload,
    payment_method_ids: [params.paymentMethodId],
    custom_payment_methods: [],
    sync_to_paypal: false,
    sync_to_stripe: false,
  };

  setError(null);
  setSubmitting(true);
  try {
    await createInvoice(payload, sessionToken);
    if (draftId && sessionToken) {
      try {
        await deleteReminderDraft(draftId, sessionToken);
      } catch {
        // Ignore draft deletion failures—invoice creation already succeeded.
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.dismissAll();
    router.replace("/(tabs)");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to create this invoice right now.");
  } finally {
    setSubmitting(false);
  }
}

function parseJSON(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  remindersLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  remindersLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  header: {
    gap: Theme.spacing.xs,
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
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

function parseAmount(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
}

function formatDueDateTimestamp(value: string) {
  const iso = `${value}T12:00:00Z`;
  return new Date(iso).toISOString();
}

function buildSchedulePayload(
  mode: ReminderSummaryData["schedule"]["mode"],
  rawData: any,
): ReminderSchedulePayload | null {
  if (!rawData) {
    return null;
  }
  if (mode === "manual") {
    const entries = rawData.entries ?? [];
    if (!entries.length) {
      return null;
    }
    return {
      mode: "manual",
      manual_dates: entries.map((entry: any) => toDateTime(entry.date, entry.time)),
      tone_sequence: entries.map((entry: any) => entry.tone ?? "gentle"),
      max_reminders: entries.length,
    };
  }
  if (mode === "weekly") {
    return {
      mode: "weekly",
      weekly_pattern: {
        weekdays: Array.isArray(rawData.days) ? rawData.days : [],
        time_of_day: toTimeOfDay(rawData.time),
      },
      tone_sequence: rawData.tones ?? [],
      max_reminders: toNumberValue(rawData.maxReminders),
    };
  }
  return {
    mode: "cadence",
    cadence: {
      frequency_days: toNumberValue(rawData.frequencyDays ?? rawData.frequency_days) ?? 0,
      start_date: rawData.startDate ?? rawData.start_date ?? null,
      start_time: rawData.startTime ? toTimeOfDay(rawData.startTime) : null,
    },
    tone_sequence: rawData.tones ?? [],
    max_reminders: toNumberValue(rawData.maxReminders),
  };
}

function toDateTime(date: string, time: string) {
  if (!date) {
    return new Date().toISOString();
  }
  const safeTime = time && time.includes(":") ? time : "09:00";
  const iso = new Date(`${date}T${safeTime}:00`);
  return iso.toISOString();
}

function toTimeOfDay(value?: string) {
  if (!value) {
    return "09:00:00";
  }
  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return `${value}:00`;
}

function resolveDeliveryChannel(platform?: string, mode?: string): DeliveryChannel {
  if (platform === "gmail") {
    return mode === "self" ? "gmail" : "mailgun";
  }
  if (platform === "outlook") {
    return mode === "self" ? "outlook" : "mailgun";
  }
  if (platform === "whatsapp") {
    return "whatsapp";
  }
  if (platform === "telegram") {
    return "telegram";
  }
  if (platform === "slack") {
    return "slack";
  }
  return "mailgun";
}

function toNumberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
