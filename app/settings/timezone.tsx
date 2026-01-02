import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchTimezones, TimezoneInfo } from "@/services/timezones";

const palette = Theme.palette;
const TIMEZONE_CACHE_KEY = "cache.settings.timezones";

export const options = {
  headerShown: false,
};

export default function TimezoneSettingsScreen() {
  const router = useRouter();
  const { user, updateUserProfile } = useAuth();
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingZone, setSavingZone] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fallbackTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const currentZone = user?.default_timezone ?? fallbackTimezone;

  const sortTimezones = useCallback((zones: TimezoneInfo[]) => {
    return zones
      .slice()
      .sort((a, b) =>
        a.offset_minutes === b.offset_minutes
          ? a.name.localeCompare(b.name)
          : a.offset_minutes - b.offset_minutes
      );
  }, []);

  const loadTimezones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await getCachedValue<TimezoneInfo[]>(TIMEZONE_CACHE_KEY);
      if (cached?.length) {
        setTimezones(sortTimezones(cached));
        setLoading(false);
      }
      const remote = await fetchTimezones();
      const normalized = sortTimezones(remote);
      setTimezones(normalized);
      await setCachedValue(TIMEZONE_CACHE_KEY, normalized);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load timezones."
      );
    } finally {
      setLoading(false);
    }
  }, [sortTimezones]);

  useEffect(() => {
    loadTimezones();
  }, [loadTimezones]);

  const filteredTimezones = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return timezones;
    }
    return timezones.filter(
      (timezone) =>
        timezone.name.toLowerCase().includes(query) ||
        timezone.label.toLowerCase().includes(query)
    );
  }, [search, timezones]);

  const handleSelect = async (timezone: TimezoneInfo) => {
    if (timezone.name === currentZone || savingZone) {
      return;
    }
    setSavingZone(timezone.name);
    setError(null);
    try {
      await Haptics.selectionAsync();
      await updateUserProfile({ defaultTimezone: timezone.name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update your timezone."
      );
    } finally {
      setSavingZone(null);
    }
  };

  const listHeader = (
    <View style={styles.headerWrapper}>
      <Pressable style={styles.backLink} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color={palette.ink} />
        <Text style={styles.backLabel}>Back to settings</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Reminder timezone</Text>
        <Text style={styles.subtitle}>
          Choose the timezone DueSoon should use by default when scheduling
          reminders.
        </Text>
      </View>

      <View style={styles.searchField}>
        <Feather name="search" size={16} color={palette.slate} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by region or offset"
          placeholderTextColor={palette.slateSoft}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredTimezones}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => {
          const isActive = item.name === currentZone;
          const isSaving = savingZone === item.name;
          return (
            <Pressable
              style={[styles.row, isActive && styles.rowActive]}
              onPress={() => handleSelect(item)}
              disabled={isSaving}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSubtle}>{item.name}</Text>
              </View>
              {isActive ? (
                <Feather name="check" size={18} color={palette.slate} />
              ) : isSaving ? (
                <ActivityIndicator color={palette.slate} />
              ) : (
                <Feather name="circle" size={16} color={palette.slateSoft} />
              )}
            </Pressable>
          );
        }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={{ height: Theme.spacing.xl }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.ink} />
              <Text style={styles.loadingLabel}>Loading timezones…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No timezones match your search.
            </Text>
          )
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  headerWrapper: {
    gap: Theme.spacing.lg,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: palette.slate,
  },
  header: {
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: palette.inkMuted,
    lineHeight: 22,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    gap: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: palette.ink,
  },
  errorText: {
    color: palette.accent,
    fontSize: 14,
  },
  loadingState: {
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  loadingLabel: {
    fontSize: 14,
    color: palette.slate,
  },
  row: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowActive: {
    backgroundColor: palette.surface,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    color: palette.ink,
    fontWeight: "500",
  },
  rowSubtle: {
    fontSize: 13,
    color: palette.slate,
  },
  emptyText: {
    padding: Theme.spacing.md,
    textAlign: "center",
    color: palette.slate,
  },
});
