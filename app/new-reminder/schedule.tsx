import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ReminderSchedulePicker, { ReminderScheduleSelection } from "@/components/reminder-schedule-picker";
import { Theme } from "@/constants/theme";
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";
import { useAuth } from "@/providers/auth-provider";
import { fetchClient } from "@/services/clients";
import { fetchTimezones, TimezoneInfo } from "@/services/timezones";
import type { ReminderScheduleMode } from "@/types/invoices";
import type { ReminderScheduleSummaryValue } from "@/lib/reminder-schedule";

export default function ScheduleScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const draftId = persistedParams.draftId ?? null;
  const baseParams = useMemo(() => {
    const next = { ...persistedParams };
    delete next.draftId;
    return next;
  }, [persistedParams]);
  const initialMode = useMemo<ReminderScheduleMode>(() => {
    const modeParam = persistedParams.scheduleMode;
    if (modeParam === "manual" || modeParam === "weekly" || modeParam === "cadence") {
      return modeParam as ReminderScheduleMode;
    }
    return "manual";
  }, [persistedParams.scheduleMode]);
  const initialSummary = useMemo<ReminderScheduleSummaryValue | null>(
    () => parseScheduleSummary(persistedParams.scheduleSummary),
    [persistedParams.scheduleSummary],
  );
  const [selection, setSelection] = useState<ReminderScheduleSelection | null>(null);
  const fallbackTimezone =
    user?.default_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const [timezone, setTimezone] = useState(persistedParams.timezone ?? fallbackTimezone);
  const [timezoneDirty, setTimezoneDirty] = useState(Boolean(persistedParams.timezone));
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneInfo[]>([]);
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [timezoneLoading, setTimezoneLoading] = useState(false);
  const [clientTimezone, setClientTimezone] = useState<string | null>(null);

  const effectiveMode = selection?.mode ?? initialMode;
  const scheduleSummaryString = selection?.summaryString ?? persistedParams.scheduleSummary ?? "";
  const canContinue = Boolean(selection?.canSubmit && timezone);
  useEffect(() => {
    if (!baseParams.clientId || !session?.accessToken) return;
    let cancelled = false;
    const loadClientTimezone = async () => {
      try {
        const clientRecord = await fetchClient(baseParams.clientId as string, session.accessToken!);
        if (!cancelled) {
          setClientTimezone(clientRecord.timezone ?? null);
        }
      } catch {
        // ignore failures; fallback to default timezone.
      }
    };
    loadClientTimezone();
    return () => {
      cancelled = true;
    };
  }, [baseParams.clientId, session?.accessToken]);

  useEffect(() => {
    if (clientTimezone && !timezoneDirty) {
      setTimezone(clientTimezone);
    }
  }, [clientTimezone, timezoneDirty]);

  useEffect(() => {
    let cancelled = false;
    const loadTimezones = async () => {
      setTimezoneLoading(true);
      try {
        const list = await fetchTimezones();
        if (!cancelled) {
          setTimezoneOptions(
            list.slice().sort((a, b) => {
              if (a.offset_minutes === b.offset_minutes) {
                return a.name.localeCompare(b.name);
              }
              return a.offset_minutes - b.offset_minutes;
            })
          );
        }
      } catch {
        if (!cancelled) {
          setTimezoneOptions([]);
        }
      } finally {
        if (!cancelled) {
          setTimezoneLoading(false);
        }
      }
    };
    loadTimezones();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTimezones = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase();
    if (!query) return timezoneOptions;
    return timezoneOptions.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query)
    );
  }, [timezoneOptions, timezoneSearch]);

  const handleTimezoneSelect = useCallback((zone: string) => {
    setTimezone(zone);
    setTimezoneDirty(true);
    setTimezoneModalVisible(false);
  }, []);
  const paramsForDraft = useMemo(() => {
    const next: Record<string, string> = { ...baseParams };
    next.scheduleMode = effectiveMode;
    if (scheduleSummaryString) {
      next.scheduleSummary = scheduleSummaryString;
    } else {
      delete next.scheduleSummary;
    }
    next.timezone = timezone;
    return next;
  }, [baseParams, effectiveMode, scheduleSummaryString, timezone]);
  const metadata = useMemo(() => {
    const manualCount = selection?.manualCount ?? 0;
    const weeklyCount = selection?.weeklyDayCount ?? 0;
    const cadenceFrequency = selection?.cadenceFrequency ?? "?";
    return {
      client_name: baseParams.client || "New reminder",
      amount_display: formatAmountDisplay(baseParams.amount, baseParams.currency),
      status:
        effectiveMode === "manual"
          ? `Manual (${manualCount} dates)`
          : effectiveMode === "weekly"
            ? `Weekly cadence (${weeklyCount} days)`
            : `Cadence every ${cadenceFrequency} days`,
      next_action: "Review the reminder summary.",
    };
  }, [
    baseParams.amount,
    baseParams.currency,
    baseParams.client,
    effectiveMode,
    selection,
  ]);
  const { ensureDraftSaved } = useReminderDraftPersistor({
    token: session?.accessToken ?? null,
    draftId,
    params: paramsForDraft,
    metadata,
    lastStep: "schedule",
    lastPath: "/new-reminder/schedule",
    enabled: Boolean(session?.accessToken && draftId),
  });
  const handleReturnToReminders = () => {
    router.replace("/reminders");
  };
  const handleBack = () => {
    if (draftId) {
      router.push({
        pathname: "/new-reminder/payment-method",
        params: {
          ...baseParams,
          ...(draftId ? { draftId } : {}),
        },
      });
      return;
    }
    router.back();
  };

  const handleSaveSchedule = async () => {
    if (!selection || !timezone) {
      return;
    }
    await Haptics.selectionAsync();
    const savedDraftId = await ensureDraftSaved();
    router.push({
      pathname: "/new-reminder/summary",
      params: {
        ...baseParams,
        scheduleMode: selection.mode,
        scheduleSummary: selection.summaryString,
        timezone,
        ...(savedDraftId ? { draftId: savedDraftId } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navRow}>
          <Pressable style={styles.backLink} onPress={handleBack}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Back to payment method</Text>
          </Pressable>
          {draftId ? (
            <Pressable style={styles.remindersLink} onPress={handleReturnToReminders}>
              <Feather name="home" size={18} color={Theme.palette.slate} />
              <Text style={styles.remindersLabel}>Reminders</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Schedule reminders</Text>
          <Text style={styles.subtitle}>
            Choose how DueSoon should pace each follow-up. You can preview the queue before sending.
          </Text>
        </View>

        <View style={styles.timezoneCard}>
          <View style={styles.timezoneCardText}>
            <Text style={styles.timezoneLabel}>Reminder timezone</Text>
            <Text style={styles.timezoneValue}>{timezone}</Text>
          </View>
          <Pressable style={styles.timezoneChangeButton} onPress={() => setTimezoneModalVisible(true)}>
            <Feather name="map-pin" size={16} color="#FFFFFF" />
            <Text style={styles.timezoneChangeLabel}>Change</Text>
          </Pressable>
        </View>

        <ReminderSchedulePicker initialMode={initialMode} initialSummary={initialSummary} onChange={setSelection} />

        <Pressable
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          disabled={!canContinue}
          onPress={handleSaveSchedule}
        >
          <Text style={styles.primaryButtonText}>Save schedule</Text>
        </Pressable>
      </ScrollView>
      <Modal
        visible={timezoneModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimezoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select a timezone</Text>
            <View style={styles.modalSearch}>
              <Feather name="search" size={16} color={Theme.palette.slate} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by region or offset"
                placeholderTextColor={Theme.palette.slateSoft}
                value={timezoneSearch}
                onChangeText={setTimezoneSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {timezoneLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={Theme.palette.ink} />
              </View>
            ) : (
              <ScrollView style={styles.timezoneList}>
                {filteredTimezones.map((entry) => {
                  const active = entry.name === timezone;
                  return (
                    <Pressable
                      key={entry.name}
                      style={[styles.timezoneRow, active && styles.timezoneRowActive]}
                      onPress={() => handleTimezoneSelect(entry.name)}
                    >
                      <View>
                        <Text style={styles.timezoneRowLabel}>{entry.label}</Text>
                        <Text style={styles.timezoneRowSubtle}>{entry.name}</Text>
                      </View>
                      {active ? (
                        <Feather name="check" size={18} color={Theme.palette.slate} />
                      ) : (
                        <Feather name="circle" size={16} color={Theme.palette.slateSoft} />
                      )}
                    </Pressable>
                  );
                })}
                {!filteredTimezones.length && !timezoneLoading ? (
                  <Text style={styles.emptyListText}>No timezones match your search.</Text>
                ) : null}
              </ScrollView>
            )}
            <Pressable style={styles.modalDismiss} onPress={() => setTimezoneModalVisible(false)}>
              <Text style={styles.modalDismissLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  timezoneCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.md,
  },
  timezoneCardText: {
    flex: 1,
    gap: 4,
  },
  timezoneLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timezoneValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  timezoneChangeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    backgroundColor: Theme.palette.ink,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radii.md,
  },
  timezoneChangeLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: Theme.radii.xl,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  modalSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  timezoneList: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    maxHeight: 360,
  },
  timezoneRow: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  timezoneRowActive: {
    backgroundColor: Theme.palette.surface,
  },
  timezoneRowLabel: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  timezoneRowSubtle: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  emptyListText: {
    padding: Theme.spacing.md,
    textAlign: "center",
    color: Theme.palette.slate,
  },
  modalDismiss: {
    alignSelf: "flex-end",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  modalDismissLabel: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  loadingState: {
    paddingVertical: Theme.spacing.lg,
    alignItems: "center",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});



function parseScheduleSummary(value?: string): ReminderScheduleSummaryValue | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ReminderScheduleSummaryValue;
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

function formatAmountDisplay(amount?: string, currency?: string) {
  if (!amount) return null;
  if (/[A-Za-z$€£¥₹₦₽₱₴₭₮₩]/.test(amount)) {
    return amount;
  }
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}
