import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ClientListItem } from "@/data/mock-clients";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { buildPastClientRow } from "@/lib/dashboard-clients";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchDashboardSummary,
  type DashboardClientSummary,
  type DashboardSummary,
} from "@/services/dashboard";
import { ClientList } from "./(tabs)/index";

const DASHBOARD_CACHE_KEY = "cache.dashboard.summary";

export default function PastClientsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastClients, setPastClients] = useState<DashboardClientSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<DashboardSummary>(DASHBOARD_CACHE_KEY);
      if (!cancelled && cached?.past_clients) {
        setPastClients(cached.past_clients);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPastClients = useCallback(
    async (options?: { isRefreshing?: boolean }) => {
      if (!session?.accessToken) {
        setError("Sign in again to review past clients.");
        setPastClients([]);
        return;
      }
      if (options?.isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const summary = await fetchDashboardSummary(session.accessToken);
        setPastClients(summary.past_clients);
        await setCachedValue(DASHBOARD_CACHE_KEY, summary);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load past clients at the moment."
        );
      } finally {
        if (options?.isRefreshing) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [session?.accessToken]
  );

  useEffect(() => {
    loadPastClients();
  }, [loadPastClients]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return pastClients;
    const query = search.trim().toLowerCase();
    return pastClients.filter((entry) => {
      const { client } = entry;
      const fields = [
        client.name,
        client.company_name ?? "",
        client.email ?? "",
      ];
      return fields.some((value) =>
        value?.toLowerCase().includes(query)
      );
    });
  }, [pastClients, search]);

  const clientRows = useMemo<ClientListItem[]>(() => {
    return filteredRows.map((entry) => buildPastClientRow(entry));
  }, [filteredRows]);

  const handleRefresh = useCallback(async () => {
    await loadPastClients({ isRefreshing: true });
  }, [loadPastClients]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Theme.palette.ink}
          />
        }
      >
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Dashboard</Text>
        </Pressable>
        <View style={styles.header}>
          <Text style={styles.title}>Past clients</Text>
          <Text style={styles.subtitle}>
            Search archived relationships and reopen them when needed.
          </Text>
        </View>
        <View style={styles.searchField}>
          <Feather name="search" size={16} color={Theme.palette.slateSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or company"
            placeholderTextColor={Theme.palette.slateSoft}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <ClientList
          title="All past clients"
          clients={clientRows}
          totalCount={clientRows.length}
          loading={loading && !refreshing}
          onPress={(id) => router.push(`/client/${id}`)}
        />
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
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.slate,
    lineHeight: 22,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  errorText: {
    color: Theme.palette.accent,
    fontSize: 13,
  },
});
