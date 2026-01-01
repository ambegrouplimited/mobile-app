import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReminderSummaryDetails } from "@/components/reminder-summary";
import { Theme } from "@/constants/theme";
import { reminderDetails } from "@/data/mock-reminders";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { buildReminderSummaryFromResources } from "@/lib/reminder-summary";
import { useAuth } from "@/providers/auth-provider";
import { fetchClient } from "@/services/clients";
import { fetchInvoice } from "@/services/invoices";
import type { ReminderSummaryData } from "@/types/reminders";

const SUMMARY_CACHE_KEY = (id: string) => `cache.reminder.${id}.summary`;

export default function ReminderSummaryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    id,
    invoiceId: invoiceIdParam,
    clientId: clientIdParam,
  } = useLocalSearchParams<{
    id: string;
    invoiceId?: string | string[];
    clientId?: string | string[];
  }>();
  const reminder = id ? reminderDetails[id] : undefined;
  const [summary, setSummary] = useState<ReminderSummaryData | null>(
    reminder?.summary ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invoiceId = getParam(invoiceIdParam);
  const clientId = getParam(clientIdParam);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<ReminderSummaryData>(
        SUMMARY_CACHE_KEY(id)
      );
      if (!cancelled && cached) {
        setSummary(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !invoiceId || !session?.accessToken) return;
    let cancelled = false;
    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const [invoiceData, clientData] = await Promise.all([
          fetchInvoice(invoiceId, session.accessToken),
          clientId
            ? fetchClient(clientId, session.accessToken).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const built = buildReminderSummaryFromResources({
          invoice: invoiceData,
          client: clientData,
        });
        setSummary(built);
        await setCachedValue(SUMMARY_CACHE_KEY(id), built);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this reminder summary."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [id, invoiceId, clientId, session?.accessToken]);

  const summaryData = summary ?? reminder?.summary ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminder</Text>
        </Pressable>

        {summaryData ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Reminder summary</Text>
              <Text style={styles.subtitle}>
                Reference the instructions, delivery platform, and payout details that power this reminder.
              </Text>
              {loading ? (
                <Text style={styles.loadingText}>Refreshing summary…</Text>
              ) : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <ReminderSummaryDetails data={summaryData} />
          </>
        ) : loading ? (
          <Text style={styles.loadingText}>Loading summary…</Text>
        ) : (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Reminder not found</Text>
            <Text style={styles.placeholderDetail}>Try returning to the reminders tab.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Go back</Text>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  loadingText: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
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
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  placeholderDetail: {
    fontSize: 14,
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
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
