import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
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

export default function TimezoneOnboardingScreen() {
  const router = useRouter();
  const { user, session, updateUserProfile } = useAuth();
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingZone, setSavingZone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fallbackTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const currentZone = user?.default_timezone ?? fallbackTimezone;

  const goToSubscriptionStep = useCallback(() => {
    router.replace("/onboarding/subscription");
  }, [router]);

  const goToCurrencyStep = useCallback(() => {
    router.replace("/onboarding/currency");
  }, [router]);

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
      setRefreshing(false);
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

  const handleSelect = useCallback(
    async (timezone: TimezoneInfo) => {
      if (timezone.name === currentZone || savingZone) {
        return;
      }
      if (!session?.accessToken) {
        router.replace("/login");
        return;
      }
      setSavingZone(timezone.name);
      setError(null);
      try {
        await Haptics.selectionAsync();
        await updateUserProfile({ defaultTimezone: timezone.name });
        goToSubscriptionStep();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to update your timezone."
        );
      } finally {
        setSavingZone(null);
      }
    },
    [
      currentZone,
      goToSubscriptionStep,
      router,
      savingZone,
      session?.accessToken,
      updateUserProfile,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: TimezoneInfo }) => {
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
    },
    [currentZone, handleSelect, savingZone]
  );

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredTimezones}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <View style={styles.headerActions}>
              <Pressable style={styles.backButton} onPress={goToCurrencyStep}>
                <Feather name="chevron-left" size={16} color={palette.slate} />
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.skipButton}
                onPress={goToSubscriptionStep}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>
            </View>
            <View>
              <Text style={styles.progressLabel}>Step 2 of 3</Text>
              <Text style={styles.progressTitle}>Choose your timezone</Text>
            </View>
            <Text style={styles.subtitle}>
              We’ll use this timezone when scheduling reminders. Changing it
              later is always possible.
            </Text>
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
        }
        ListFooterComponent={<View style={{ height: Theme.spacing.xl }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.ink} />
              <Text style={styles.loadingLabel}>Loading timezones…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No timezones match your search.</Text>
          )
        }
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadTimezones();
        }}
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
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 13,
    color: palette.slate,
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: palette.slate,
  },
  skipButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  skipButtonText: {
    fontSize: 14,
    color: palette.slate,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: Theme.spacing.xs / 2,
  },
  backButtonText: {
    fontSize: 14,
    color: palette.slate,
    fontWeight: "600",
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    color: palette.ink,
  },
  row: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
  },
  rowActive: {
    borderColor: palette.slate,
    backgroundColor: palette.surface,
  },
  rowText: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: palette.ink,
  },
  rowSubtle: {
    fontSize: 13,
    color: palette.slate,
  },
  loadingState: {
    paddingVertical: Theme.spacing.xl,
    alignItems: "center",
  },
  loadingLabel: {
    marginTop: Theme.spacing.sm,
    color: palette.slate,
  },
  emptyText: {
    textAlign: "center",
    color: palette.slate,
    marginVertical: Theme.spacing.xl,
  },
  errorText: {
    color: Theme.palette.accent,
  },
});
