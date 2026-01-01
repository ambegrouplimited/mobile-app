import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { formatCurrency } from "@/lib/dashboard-clients";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchReminderDrafts } from "@/services/reminder-drafts";
import { fetchUpcomingReminders } from "@/services/reminders";
import type { ReminderDraft } from "@/types/reminder-drafts";
import type { UpcomingReminder } from "@/types/reminders";

const UPCOMING_REMINDERS_CACHE_KEY = "cache.reminders.upcoming";
const UPCOMING_LIMIT = 3;

export default function RemindersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [upcoming, setUpcoming] = useState<UpcomingReminder[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ReminderDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<UpcomingReminder[]>(
        UPCOMING_REMINDERS_CACHE_KEY
      );
      if (!cancelled && cached) {
        setUpcoming(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadUpcoming = async () => {
      if (!session?.accessToken) {
        setError("Sign in to view upcoming reminders.");
        setUpcoming([]);
        return;
      }
      setLoadingUpcoming(true);
      setError(null);
      try {
        const response = await fetchUpcomingReminders(session.accessToken, {
          limit: UPCOMING_LIMIT,
        });
        setUpcoming(response);
        await setCachedValue(UPCOMING_REMINDERS_CACHE_KEY, response);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load upcoming reminders right now."
        );
      } finally {
        setLoadingUpcoming(false);
      }
    };
    loadUpcoming();
  }, [session?.accessToken]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadDrafts = async () => {
        if (!session?.accessToken) {
          if (!cancelled) {
            setDrafts([]);
            setDraftsError("Sign in to see your reminder drafts.");
            setDraftsLoading(false);
          }
          return;
        }
        setDraftsLoading(true);
        setDraftsError(null);
        try {
          const response = await fetchReminderDrafts(session.accessToken);
          if (!cancelled) {
            setDrafts(response);
          }
        } catch (err) {
          if (!cancelled) {
            setDrafts([]);
            setDraftsError(
              err instanceof Error ? err.message : "Unable to load drafts right now.",
            );
          }
        } finally {
          if (!cancelled) {
            setDraftsLoading(false);
          }
        }
      };
      loadDrafts();
      return () => {
        cancelled = true;
      };
    }, [session?.accessToken]),
  );

  const upcomingCards = useMemo(() => {
    return upcoming.map((item) => {
      const amount = formatCurrency(item.invoice_amount, item.invoice_currency);
      return {
        id: item.id,
        client: item.client_name,
        amount,
        status: formatReminderStatus(item),
        nextAction: formatNextAction(item.scheduled_for),
        schedule: formatScheduleSummary(item.invoice_schedule),
        invoiceId: item.invoice_id,
        clientId: item.client_id,
        platform: item.invoice_send_via,
      };
    });
  }, [upcoming]);

  const draftCards = useMemo(() => {
    return drafts.map((draft) => {
      const params = draft.params ?? {};
      const client = draft.metadata?.client_name || params.client || "Untitled reminder";
      const amount = draft.metadata?.amount_display || params.amount || "";
      const status = draft.metadata?.status || "Draft";
      const next = draft.metadata?.next_action || "Tap to resume your reminder.";
      return {
        id: draft.id,
        client,
        amount,
        status,
        next,
        draft,
      };
    });
  }, [drafts]);

  const handleDraftPress = useCallback(
    (draft: ReminderDraft) => {
      if (!draft) return;
      const params: Record<string, string> = {};
      Object.entries(draft.params ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params[key] = String(value);
        }
      });
      params.draftId = draft.id;
      router.push({
        pathname: draft.last_path || "/(tabs)/new-reminder",
        params,
      });
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <View style={styles.list}>
            {loadingUpcoming && !upcomingCards.length ? (
              <Text style={styles.cardNext}>Loading upcoming reminders…</Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : !upcomingCards.length ? (
              <Text style={styles.cardNext}>
                No queued reminders. Draft one to get started.
              </Text>
            ) : (
              upcomingCards.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: "/reminders/[id]",
                      params: {
                        id: item.id,
                        client: item.client,
                        amount: item.amount,
                        status: item.status,
                        nextAction: item.nextAction,
                        schedule: item.schedule,
                        invoiceId: item.invoiceId,
                        clientId: item.clientId,
                        platform: item.platform,
                      },
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardClient}>{item.client}</Text>
                    <Text style={styles.cardAmount}>{item.amount}</Text>
                  </View>
                  <View style={styles.row}>
                    <Feather
                      name="mail"
                      size={16}
                      color={Theme.palette.slate}
                    />
                    <Text style={styles.cardStatus}>{item.status}</Text>
                  </View>
                  <Text style={styles.cardNext}>{item.nextAction}</Text>
                  <Text style={styles.cardSchedule}>{item.schedule}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drafts</Text>
          <View style={styles.list}>
            {draftsLoading && !draftCards.length ? (
              <Text style={styles.cardNext}>Loading drafts…</Text>
            ) : draftsError ? (
              <Text style={styles.errorText}>{draftsError}</Text>
            ) : !draftCards.length ? (
              <Text style={styles.cardNext}>
                No drafts saved yet. Start a new reminder to create one.
              </Text>
            ) : (
              draftCards.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.card, styles.cardDraft]}
                  onPress={() => handleDraftPress(item.draft)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardClient}>{item.client}</Text>
                    {item.amount ? <Text style={styles.cardAmount}>{item.amount}</Text> : null}
                  </View>
                  <View style={styles.row}>
                    <Feather name="edit-3" size={16} color={Theme.palette.slate} />
                    <Text style={styles.cardStatus}>{item.status}</Text>
                  </View>
                  <Text style={styles.cardNext}>{item.next}</Text>
                </Pressable>
              ))
            )}
          </View>
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
    gap: Theme.spacing.md,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  list: {
    gap: Theme.spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardClient: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  cardStatus: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  cardNext: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  cardSchedule: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  cardDraft: {
    borderStyle: "dashed",
    borderColor: Theme.palette.border,
  },
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
});

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatReminderStatus(reminder: UpcomingReminder) {
  const statusLabel = capitalize(reminder.status);
  const channel = formatChannelLabel(reminder.invoice_send_via);
  return `${statusLabel} via ${channel}`;
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
      return "WhatsApp";
    case "telegram":
      return "Telegram";
    case "slack":
      return "Slack";
    case "auto":
      return "Auto";
    default:
      return channel;
  }
}

function formatNextAction(value: string) {
  if (!value) return "Send date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Send date pending";
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Send on ${dateLabel} • ${timeLabel}`;
}

function formatScheduleSummary(schedule: UpcomingReminder["invoice_schedule"]) {
  if (!schedule) return "Schedule building";
  if (schedule.mode === "weekly") {
    const days = schedule.weekly_pattern?.weekdays ?? [];
    const label = days.length
      ? days.map((day) => WEEKDAY_LABELS[day] ?? day).join("/")
      : "Weekly cadence";
    return `Weekly • ${label}`;
  }
  if (schedule.mode === "cadence") {
    const freq = schedule.cadence?.frequency_days;
    return freq
      ? `Cadence • Every ${freq} day${freq === 1 ? "" : "s"}`
      : "Cadence schedule";
  }
  if (schedule.mode === "manual") {
    return "Manual delivery plan";
  }
  return "Custom schedule";
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
