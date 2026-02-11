import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { reminderDetails } from "@/data/mock-reminders";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchReminderHistory } from "@/services/reminders";
import type { Reminder } from "@/types/invoices";

const formatDeliveryTimestamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Time unknown";
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = date.getDate();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${month} ${day} • ${time}`;
};

const HISTORY_CACHE_KEY = (invoiceId: string) => `cache.reminder.${invoiceId}.history`;
const HISTORY_LIMIT = 5;

export default function ReminderHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id: string; invoiceId?: string | string[] }>();
  const id = getParam(params.id);
  const invoiceId = getParam(params.invoiceId);
  const reminder = id ? reminderDetails[id] : undefined;
  const fallbackDeliveries =
    reminder?.deliveries?.map((delivery) => ({
      id: delivery.id,
      invoice_id: reminder.id,
      client_id: "",
      user_id: "",
      scheduled_for: delivery.sentAt,
      tone: "gentle",
      status: "sent",
      delivery_channel: delivery.channel as Reminder["delivery_channel"],
      sent_at: delivery.sentAt,
      last_error: null,
    })) ?? [];
  const [history, setHistory] = useState<Reminder[]>(
    fallbackDeliveries.sort(
      (a, b) =>
        new Date(b.sent_at ?? b.scheduled_for).getTime() -
        new Date(a.sent_at ?? a.scheduled_for).getTime()
    )
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<Reminder[]>(HISTORY_CACHE_KEY(invoiceId));
      if (!cancelled && cached) {
        setHistory(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId || !session?.accessToken) return;
    let cancelled = false;
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchReminderHistory(session.accessToken, invoiceId, {
          limit: HISTORY_LIMIT,
        });
        if (cancelled) return;
        const sorted = response.sort(
          (a, b) =>
            new Date(b.sent_at ?? b.scheduled_for).getTime() -
            new Date(a.sent_at ?? a.scheduled_for).getTime()
        );
        setHistory(sorted);
        await setCachedValue(HISTORY_CACHE_KEY(invoiceId), sorted);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load past deliveries."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, session?.accessToken]);

  const deliveryCards = useMemo(() => {
    return history.map((item) => {
      const title = `${capitalize(item.tone ?? "gentle")} reminder`;
      const statusLabel = capitalize(item.status ?? "sent");
      const sentLabel = formatDeliveryTimestamp(item.sent_at ?? item.scheduled_for ?? "");
      const channelLabel = formatChannelLabel(item.delivery_channel ?? "");
      const summary = `Delivered ${
        item.delivery_channel ? `via ${channelLabel}` : "to the client"
      } at ${sentLabel}.`;
      return {
        id: item.id,
        subject: title,
        status: statusLabel,
        meta: `${sentLabel} · ${channelLabel}`,
        summary,
      };
    });
  }, [history]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminder</Text>
        </Pressable>

        {reminder || invoiceId ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.sectionEyebrow}>Past deliveries</Text>
              <Text style={styles.clientName}>{reminder?.client ?? "Reminder"}</Text>
              {reminder?.amount ? (
                <Text style={styles.amount}>{reminder.amount}</Text>
              ) : null}
              {reminder?.scheduleMode ? (
                <Text style={styles.meta}>{reminder.scheduleMode}</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deliveries</Text>
              {loading && !deliveryCards.length ? (
                <View style={styles.placeholderCard}>
                  <Feather name="loader" size={20} color={Theme.palette.slate} />
                  <Text style={styles.placeholderTitle}>Loading past deliveries…</Text>
                </View>
              ) : error ? (
                <View style={styles.placeholderCard}>
                  <Feather name="alert-triangle" size={20} color={Theme.palette.accent} />
                  <Text style={styles.placeholderTitle}>Unable to load history</Text>
                  <Text style={styles.placeholderDetail}>{error}</Text>
                </View>
              ) : deliveryCards.length > 0 ? (
                <View style={styles.deliveryList}>
                  {deliveryCards.map((delivery) => (
                    <View key={delivery.id} style={styles.deliveryCard}>
                      <View style={styles.deliveryHeader}>
                        <Text style={styles.deliverySubject}>{delivery.subject}</Text>
                        <Text style={styles.deliveryStatus}>{delivery.status}</Text>
                      </View>
                      <View style={styles.deliveryMetaRow}>
                        <Feather name="clock" size={14} color={Theme.palette.slate} />
                        <Text style={styles.deliveryMeta}>{delivery.meta}</Text>
                      </View>
                      <Text style={styles.deliverySummary}>{delivery.summary}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.placeholderCard}>
                  <Feather name="inbox" size={20} color={Theme.palette.slate} />
                  <Text style={styles.placeholderTitle}>No deliveries yet</Text>
                  <Text style={styles.placeholderDetail}>
                    Reminder sends will appear here after they go out.
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.placeholderCard}>
            <Feather name="alert-triangle" size={20} color={Theme.palette.slate} />
            <Text style={styles.placeholderTitle}>Reminder not found</Text>
            <Text style={styles.placeholderDetail}>Try returning to the reminders tab.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Go back</Text>
            </Pressable>
          </View>
        )}
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
  headerCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: 4,
  },
  sectionEyebrow: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  amount: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  meta: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  deliveryList: {
    gap: Theme.spacing.sm,
  },
  deliveryCard: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Theme.spacing.sm,
  },
  deliverySubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  deliveryStatus: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  deliveryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  deliveryMeta: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  deliverySummary: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  placeholderCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: "flex-start",
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  placeholderDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  primaryButton: {
    marginTop: Theme.spacing.sm,
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

function getParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatChannelLabel(channel: string) {
  switch (channel) {
    case "gmail":
    case "email":
      return "Gmail";
    case "email_outlook":
    case "outlook":
      return "Outlook";
    case "mailgun":
      return "Mailgun";
    case "whatsapp":
      return "WhatsApp Business";
    case "telegram":
      return "Telegram Business";
    case "slack":
      return "Slack";
    default:
      return channel || "Channel unknown";
  }
}

function capitalize(value?: string | null) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
