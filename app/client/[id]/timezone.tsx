import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { fetchClient, updateClient } from "@/services/clients";
import { fetchTimezones, TimezoneInfo } from "@/services/timezones";
import type { Client } from "@/types/clients";
import { useAuth } from "@/providers/auth-provider";

const palette = Theme.palette;

export default function ClientTimezoneScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingZone, setSavingZone] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fallbackTimezone = user?.default_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const currentZone = client?.timezone ?? fallbackTimezone;

  const loadClient = useCallback(async () => {
    if (!id || !session?.accessToken) return;
    try {
      const record = await fetchClient(id, session.accessToken);
      setClient(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load client timezone.");
    }
  }, [id, session?.accessToken]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchTimezones();
        setTimezones(
          list.slice().sort((a, b) => {
            if (a.offset_minutes === b.offset_minutes) {
              return a.name.localeCompare(b.name);
            }
            return a.offset_minutes - b.offset_minutes;
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load timezones.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredTimezones = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return timezones;
    return timezones.filter(
      (timezone) =>
        timezone.name.toLowerCase().includes(query) ||
        timezone.label.toLowerCase().includes(query)
    );
  }, [search, timezones]);

  const handleSelect = async (timezone: TimezoneInfo) => {
    if (!id || !session?.accessToken) return;
    if (timezone.name === currentZone || savingZone) return;
    setSavingZone(timezone.name);
    setError(null);
    try {
      await Haptics.selectionAsync();
      await updateClient(id, { timezone: timezone.name }, session.accessToken);
      setClient((prev) => (prev ? { ...prev, timezone: timezone.name } : prev));
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the client timezone.");
    } finally {
      setSavingZone(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={palette.ink} />
          <Text style={styles.backLabel}>Back to client</Text>
        </Pressable>
        <View style={styles.header}>
          <Text style={styles.title}>Client timezone</Text>
          <Text style={styles.subtitle}>
            Reminders for this client will use the timezone you select here unless you override it for an individual
            schedule.
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
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.ink} />
            <Text style={styles.loadingLabel}>Loading timezones…</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredTimezones.map((timezone) => {
              const isActive = timezone.name === currentZone;
              const isSaving = savingZone === timezone.name;
              return (
                <Pressable
                  key={timezone.name}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => handleSelect(timezone)}
                  disabled={isSaving}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{timezone.label}</Text>
                    <Text style={styles.rowSubtle}>{timezone.name}</Text>
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
            })}
            {!filteredTimezones.length && !loading ? (
              <Text style={styles.emptyText}>No timezones match your search.</Text>
            ) : null}
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
  list: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Theme.radii.lg,
    overflow: "hidden",
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
