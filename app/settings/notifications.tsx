import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";

const NOTIFICATIONS_CACHE_KEY = "cache.settings.notifications";
const REMINDER_MIN_LEAD = 5;
const REMINDER_MAX_LEAD = 10080;
const REMINDER_DEFAULTS = {
  enabled: true,
  lead_minutes: [30],
};

type NotificationSettingsUpdate = {
  push_notifications?: boolean;
  messages?: boolean;
  reminder_pre_notifications?: {
    enabled?: boolean;
    lead_minutes?: number[];
  };
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user, updateUserProfile, refreshSession } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(user?.notification_settings?.push_notifications ?? true);
  const [messageAlertsEnabled, setMessageAlertsEnabled] = useState(
    (user?.notification_settings?.push_notifications ?? true) && (user?.notification_settings?.messages ?? true),
  );
  const [preRemindersEnabled, setPreRemindersEnabled] = useState(
    user?.notification_settings?.reminder_pre_notifications?.enabled ?? REMINDER_DEFAULTS.enabled,
  );
  const [preReminderLeadMinutes, setPreReminderLeadMinutes] = useState(
    normalizeLeadList(user?.notification_settings?.reminder_pre_notifications?.lead_minutes)
  );
  const [leadInput, setLeadInput] = useState("");
  const [leadInputError, setLeadInputError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const pushPref = user?.notification_settings?.push_notifications ?? true;
    const messagePref = user?.notification_settings?.messages ?? true;
    const reminderPref = user?.notification_settings?.reminder_pre_notifications;
    const leads = reminderPref ? normalizeLeadList(reminderPref.lead_minutes) : REMINDER_DEFAULTS.lead_minutes;
    setPushEnabled(pushPref);
    setMessageAlertsEnabled(pushPref ? messagePref : false);
    setPreRemindersEnabled(reminderPref?.enabled ?? REMINDER_DEFAULTS.enabled);
    setPreReminderLeadMinutes(leads);
    setCachedValue(NOTIFICATIONS_CACHE_KEY, {
      push_notifications: pushPref,
      messages: messagePref,
      reminder_pre_notifications: {
        enabled: reminderPref?.enabled ?? REMINDER_DEFAULTS.enabled,
        lead_minutes: leads,
      },
    });
  }, [
    user?.notification_settings?.push_notifications,
    user?.notification_settings?.messages,
    user?.notification_settings?.reminder_pre_notifications,
  ]);

  useEffect(() => {
    if (user?.notification_settings) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<{
        push_notifications: boolean;
        messages: boolean;
        reminder_pre_notifications?: {
          enabled: boolean;
          lead_minutes: number[];
        };
      }>(NOTIFICATIONS_CACHE_KEY);
      if (!cancelled && cached) {
        setPushEnabled(cached.push_notifications);
        setMessageAlertsEnabled(cached.push_notifications ? cached.messages : false);
        const reminderPref = cached.reminder_pre_notifications;
        if (reminderPref) {
          setPreRemindersEnabled(reminderPref.enabled);
          setPreReminderLeadMinutes(normalizeLeadList(reminderPref.lead_minutes, { fallbackToDefault: false }));
        }
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.notification_settings]);

  const persistSettings = useCallback(
    async (payload: NotificationSettingsUpdate) => {
      setIsSaving(true);
      setError(null);
      try {
        await updateUserProfile({
          notificationSettings: payload,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update notification preferences.");
        const settings = user?.notification_settings;
        setPushEnabled(settings?.push_notifications ?? true);
        const messagePref = settings?.messages ?? true;
        const reminderPref = settings?.reminder_pre_notifications;
        const leads = reminderPref ? normalizeLeadList(reminderPref.lead_minutes) : REMINDER_DEFAULTS.lead_minutes;
        setMessageAlertsEnabled((settings?.push_notifications ?? true) ? messagePref : false);
        setPreRemindersEnabled(reminderPref?.enabled ?? REMINDER_DEFAULTS.enabled);
        setPreReminderLeadMinutes(leads);
      } finally {
        setIsSaving(false);
      }
    },
    [updateUserProfile, user?.notification_settings],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSession();
    } catch (err) {
      console.warn("Failed to refresh notification settings", err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession]);

  const handleRemoveLead = useCallback(
    async (value: number) => {
      if (!preReminderLeadMinutes.includes(value)) {
        return;
      }
      const next = preReminderLeadMinutes.filter((minutes) => minutes !== value);
      setPreReminderLeadMinutes(next);
      await persistSettings({
        reminder_pre_notifications: {
          enabled: preRemindersEnabled,
          lead_minutes: next,
        },
      });
    },
    [persistSettings, preReminderLeadMinutes, preRemindersEnabled],
  );

  const handleAddLead = useCallback(async () => {
    if (!preRemindersEnabled || !pushEnabled || isSaving) {
      return;
    }
    if (preReminderLeadMinutes.length >= 3) {
      setLeadInputError("You can add up to three warning times.");
      return;
    }
    const trimmed = leadInput.trim();
    const parsed = Number(trimmed);
    if (!trimmed || Number.isNaN(parsed)) {
      setLeadInputError("Enter a valid number of minutes.");
      return;
    }
    const normalized = clampLeadValue(parsed);
    if (preReminderLeadMinutes.includes(normalized)) {
      setLeadInputError("That warning time already exists.");
      return;
    }
    const next = [...preReminderLeadMinutes, normalized].sort((a, b) => a - b).slice(0, 3);
    setLeadInput("");
    setLeadInputError(null);
    setPreReminderLeadMinutes(next);
    await persistSettings({
      reminder_pre_notifications: {
        enabled: preRemindersEnabled,
        lead_minutes: next,
      },
    });
  }, [
    isSaving,
    leadInput,
    persistSettings,
    preReminderLeadMinutes,
    preRemindersEnabled,
    pushEnabled,
  ]);

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
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Choose how DueSoon keeps you in the loop about reminder sends and client replies.
          </Text>
        </View>

        <View style={styles.card}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <SettingRow
            label="Push notifications"
            detail="Alerts for scheduled sends and payment updates."
            value={pushEnabled}
            onValueChange={async (next) => {
              setPushEnabled(next);
              const normalizedMessages = next ? messageAlertsEnabled : false;
              setMessageAlertsEnabled(normalizedMessages);
              await persistSettings({
                push_notifications: next,
                messages: normalizedMessages,
              });
            }}
            disabled={isSaving}
          />
          <SettingRow
            label="Messages"
            detail="Notify me when a client replies through connected channels."
            value={messageAlertsEnabled}
            onValueChange={async (next) => {
              setMessageAlertsEnabled(next);
              await persistSettings({
                push_notifications: pushEnabled,
                messages: next,
              });
            }}
            disabled={!pushEnabled || isSaving}
            isLast
          />
        </View>

        <View style={styles.card}>
          <SettingRow
            label="Reminder pre-notifications"
            detail="Send a gentle heads-up push before DueSoon dispatches the reminder."
            value={preRemindersEnabled}
            onValueChange={async (next) => {
              setPreRemindersEnabled(next);
              await persistSettings({
                reminder_pre_notifications: {
                  enabled: next,
                  lead_minutes: preReminderLeadMinutes,
                },
              });
            }}
            disabled={!pushEnabled || isSaving}
          />
          <View style={styles.divider} />
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Warning schedule</Text>
            <Text style={styles.groupDetail}>
              Add up to 3 warning times (minutes before a reminder sends). We will sort them for you.
            </Text>
            {preReminderLeadMinutes.length === 0 ? (
              <Text style={styles.helperText}>No advance warnings configured.</Text>
            ) : (
              <View style={styles.chipWrap}>
                {preReminderLeadMinutes.map((minutes) => (
                  <View key={minutes} style={styles.chip}>
                    <Text style={styles.chipLabel}>{formatLeadLabel(minutes)}</Text>
                    <Pressable
                      style={styles.chipRemove}
                      disabled={!pushEnabled || !preRemindersEnabled || isSaving}
                      onPress={async () => {
                        await handleRemoveLead(minutes);
                      }}
                    >
                      <Feather name="x" size={14} color={Theme.palette.ink} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.leadInput,
                  (!pushEnabled || !preRemindersEnabled) && styles.leadInputDisabled,
                ]}
                placeholder="Minutes"
                keyboardType="number-pad"
                value={leadInput}
                onChangeText={(text) => {
                  setLeadInput(text);
                  setLeadInputError(null);
                }}
                editable={pushEnabled && preRemindersEnabled && !isSaving}
              />
              <Pressable
                style={[
                  styles.addButton,
                  (!pushEnabled || !preRemindersEnabled || isSaving) && styles.addButtonDisabled,
                ]}
                disabled={!pushEnabled || !preRemindersEnabled || isSaving}
                onPress={handleAddLead}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>Min 5 minutes, max 7 days (10,080 minutes).</Text>
            {leadInputError ? <Text style={styles.helperTextError}>{leadInputError}</Text> : null}
          </View>
          {!pushEnabled ? (
            <Text style={styles.noticeText}>
              Enable push notifications to receive advance reminders.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  label,
  detail,
  value,
  onValueChange,
  isLast,
  disabled,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Theme.palette.border, true: Theme.palette.ink }}
        thumbColor="#FFFFFF"
        disabled={disabled}
      />
    </View>
  );
}

function formatLeadLabel(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} min`;
}

function normalizeLeadList(
  values?: number[] | null,
  options: { fallbackToDefault?: boolean } = { fallbackToDefault: true },
) {
  if ((values === undefined || values === null) && options.fallbackToDefault !== false) {
    return [...REMINDER_DEFAULTS.lead_minutes];
  }
  const source = Array.isArray(values)
    ? values
    : typeof values === "number"
      ? [values]
      : [];
  const sanitized = source
    .map((value) => clampLeadValue(value))
    .filter((value) => !Number.isNaN(value));
  const unique = Array.from(new Set(sanitized)).sort((a, b) => a - b).slice(0, 3);
  return unique;
}

function clampLeadValue(value: number) {
  if (Number.isNaN(value)) return REMINDER_MIN_LEAD;
  return Math.min(REMINDER_MAX_LEAD, Math.max(REMINDER_MIN_LEAD, Math.round(value)));
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
  },
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    paddingBottom: Theme.spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    gap: Theme.spacing.md,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  rowDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.palette.border,
    marginHorizontal: Theme.spacing.lg,
    marginVertical: Theme.spacing.sm,
  },
  group: {
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  groupDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Theme.spacing.sm,
    marginHorizontal: -4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    margin: 4,
    gap: Theme.spacing.xs,
  },
  chipLabel: {
    fontSize: 14,
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  chipRemove: {
    padding: 2,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  leadInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  leadInputDisabled: {
    opacity: 0.5,
  },
  addButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.ink,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: Theme.palette.slate,
  },
  helperTextError: {
    marginTop: 4,
    fontSize: 12,
    color: Theme.palette.accent,
  },
  noticeText: {
    fontSize: 12,
    color: Theme.palette.slate,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
});
