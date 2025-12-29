import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";

const NOTIFICATIONS_CACHE_KEY = "cache.settings.notifications";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user, updateUserProfile, refreshSession } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(user?.notification_settings?.push_notifications ?? true);
  const [messageAlertsEnabled, setMessageAlertsEnabled] = useState(
    (user?.notification_settings?.push_notifications ?? true) && (user?.notification_settings?.messages ?? true),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const pushPref = user?.notification_settings?.push_notifications ?? true;
    const messagePref = user?.notification_settings?.messages ?? true;
    setPushEnabled(pushPref);
    setMessageAlertsEnabled(pushPref ? messagePref : false);
    setCachedValue(NOTIFICATIONS_CACHE_KEY, {
      push_notifications: pushPref,
      messages: messagePref,
    });
  }, [user?.notification_settings?.push_notifications, user?.notification_settings?.messages]);

  useEffect(() => {
    if (user?.notification_settings) {
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<{ push_notifications: boolean; messages: boolean }>(
        NOTIFICATIONS_CACHE_KEY
      );
      if (!cancelled && cached) {
        setPushEnabled(cached.push_notifications);
        setMessageAlertsEnabled(cached.push_notifications ? cached.messages : false);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.notification_settings]);

  const persistSettings = async (nextPush: boolean, nextMessages: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      await updateUserProfile({
        notificationSettings: {
          push_notifications: nextPush,
          messages: nextMessages,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notification preferences.");
      const pushPref = user?.notification_settings?.push_notifications ?? true;
      const messagePref = user?.notification_settings?.messages ?? true;
      setPushEnabled(pushPref);
      setMessageAlertsEnabled(pushPref ? messagePref : false);
    } finally {
      setIsSaving(false);
    }
  };

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
              await persistSettings(next, normalizedMessages);
            }}
            disabled={isSaving}
          />
          <SettingRow
            label="Messages"
            detail="Notify me when a client replies through connected channels."
            value={messageAlertsEnabled}
            onValueChange={async (next) => {
              setMessageAlertsEnabled(next);
              await persistSettings(pushEnabled, next);
            }}
            disabled={!pushEnabled || isSaving}
            isLast
          />
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
});
