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
import { buildPaidClientRow } from "@/lib/dashboard-clients";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchDashboardSummary,
  type DashboardPaidClient,
  type DashboardSummary,
} from "@/services/dashboard";
import { ClientList } from "../(tabs)/index";

const DASHBOARD_CACHE_KEY = "cache.dashboard.summary";

export default function PaidClientsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidClients, setPaidClients] = useState<DashboardPaidClient[]>([]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<DashboardSummary>(DASHBOARD_CACHE_KEY);
      if (!cancelled && cached?.paid_clients_this_week) {
        setPaidClients(cached.paid_clients_this_week);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPaidClients = useCallback(
    async (options?: { isRefreshing?: boolean }) => {
      if (!session?.accessToken) {
        setError("Sign in again to review paid clients.");
        setPaidClients([]);
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
        setPaidClients(summary.paid_clients_this_week);
        await setCachedValue(DASHBOARD_CACHE_KEY, summary);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load paid clients at the moment."
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
    loadPaidClients();
  }, [loadPaidClients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return paidClients;
    const query = search.trim().toLowerCase();
    return paidClients.filter((entry) => {
      const { client } = entry;
      const fields = [
        client.name,
        client.company_name ?? "",
        client.email ?? "",
      ];
      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [paidClients, search]);

  const clientRows = useMemo<ClientListItem[]>(() => {
    return filteredClients.map((entry) => buildPaidClientRow(entry));
  }, [filteredClients]);

  const handleRefresh = useCallback(async () => {
    await loadPaidClients({ isRefreshing: true });
  }, [loadPaidClients]);

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
          <Text style={styles.title}>Paid clients</Text>
          <Text style={styles.subtitle}>
            Everyone who has settled invoices — perfect for thank-yous or
            follow-ups.
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
          title="All paid clients"
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
