import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import type { ClientListItem } from "@/data/mock-clients";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchDashboardSummary,
  type DashboardClientSummary,
  type DashboardPaidClient,
  type DashboardSummary,
} from "@/services/dashboard";

const FILTERS = ["Not Paid", "Paid"] as const;
const DASHBOARD_CACHE_KEY = "cache.dashboard.summary";

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Not Paid");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedClientsRef = useRef<Set<string>>(new Set());

  const loadSummary = useCallback(
    async (options?: { isRefreshing?: boolean }) => {
      if (!session?.accessToken) return;
      if (options?.isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetchDashboardSummary(session.accessToken);
        setSummary(response);
        await setCachedValue(DASHBOARD_CACHE_KEY, response);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard right now."
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
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<DashboardSummary>(DASHBOARD_CACHE_KEY);
      if (!cancelled && cached) {
        setSummary(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const summaryStats = useMemo(() => {
    const metrics = summary?.metrics;
    const outstandingCurrency = "USD";
    const paidCurrency =
      summary?.paid_clients_this_week?.[0]?.invoices?.[0]?.currency ??
      outstandingCurrency;
    return [
      {
        label: "Outstanding",
        value: formatCurrency(
          metrics?.total_outstanding ?? 0,
          outstandingCurrency
        ),
        caption: metrics
          ? `${metrics.clients_waiting_payment} client${
              metrics.clients_waiting_payment === 1 ? "" : "s"
            } awaiting payment`
          : "Awaiting new reminders",
      },
      {
        label: "Paid this week",
        value: formatCurrency(metrics?.total_paid_this_week ?? 0, paidCurrency),
        caption: metrics
          ? `${metrics.clients_paid_this_week} client${
              metrics.clients_paid_this_week === 1 ? "" : "s"
            } settled`
          : "No payments recorded",
      },
    ];
  }, [summary]);

  const unpaidClients = useMemo<ClientListItem[]>(() => {
    if (!summary) return [];
    return summary.active_clients.map((entry) =>
      buildOutstandingClientRow(entry)
    );
  }, [summary]);

  const paidClients = useMemo<ClientListItem[]>(() => {
    if (!summary) return [];
    return summary.paid_clients_this_week.map((entry) =>
      buildPaidClientRow(entry)
    );
  }, [summary]);

  const pastClientRows = useMemo<ClientListItem[]>(() => {
    if (!summary) return [];
    return summary.past_clients.map((entry) => buildPastClientRow(entry));
  }, [summary]);

  const visibleClients = filter === "Not Paid" ? unpaidClients : paidClients;

  const handleRefresh = useCallback(async () => {
    await loadSummary({ isRefreshing: true });
  }, [loadSummary]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Theme.palette.ink}
          />
        }
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.summaryRow}>
          {summaryStats.map((stat) => (
            <View key={stat.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{stat.label}</Text>
              <Text style={styles.summaryValue}>{stat.value}</Text>
              <Text style={styles.summaryCaption}>{stat.caption}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterContainer}>
          <View style={styles.filterPill}>
            {FILTERS.map((option) => {
              const active = option === filter;
              return (
                <Pressable
                  key={option}
                  onPress={() => setFilter(option)}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      active && styles.filterLabelActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ClientList
          title={`${filter} clients`}
          clients={visibleClients}
          loading={loading && !refreshing && !summary}
          onPress={(id) => router.push(`/client/${id}`)}
        />
        <ClientList
          title="Past clients"
          clients={pastClientRows}
          muted
          loading={loading && !refreshing && !summary}
          onPress={(id) => router.push(`/client/${id}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const typeLabels = {
  individual: "Individual",
  business: "Business",
} as const;

function ClientList({
  title,
  clients: list,
  muted,
  onPress,
  loading,
}: {
  title: string;
  clients: ClientListItem[];
  muted?: boolean;
  onPress?: (id: string) => void;
  loading?: boolean;
}) {
  const showEmpty = !loading && list.length === 0;
  return (
    <View style={[styles.listCard, muted && styles.listCardMuted]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listMeta}>{list.length} listed</Text>
      </View>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Theme.palette.slate} />
        </View>
      ) : showEmpty ? (
        <Text style={styles.emptyText}>No clients to show right now.</Text>
      ) : (
        list.map((client) => (
          <Pressable
            key={client.id}
            style={styles.clientRow}
            onPress={() => onPress?.(client.id)}
          >
            <View style={styles.clientText}>
              <View style={styles.clientNameRow}>
                <Text style={styles.clientName}>{client.name}</Text>
                <View style={styles.clientTypeBadge}>
                  <Text style={styles.clientTypeLabel}>
                    {typeLabels[client.client_type]}
                  </Text>
                </View>
              </View>
              <Text style={styles.clientDetail}>{client.detail}</Text>
            </View>
            <View style={styles.clientAmounts}>
              <Text style={styles.clientAmount}>{client.amount}</Text>
              <View
                style={[
                  styles.badge,
                  client.status === "Paid" ? styles.badgePaid : styles.badgeDue,
                ]}
              >
                <Feather
                  name={
                    client.status === "Paid" ? "check-circle" : "alert-circle"
                  }
                  size={14}
                  color={
                    client.status === "Paid"
                      ? Theme.palette.success
                      : Theme.palette.slate
                  }
                />
                <Text
                  style={[
                    styles.badgeLabel,
                    client.status === "Paid"
                      ? styles.badgeLabelPaid
                      : styles.badgeLabelDue,
                  ]}
                >
                  {client.status}
                </Text>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function buildOutstandingClientRow(
  entry: DashboardClientSummary
): ClientListItem {
  const { client, total_amount } = entry;
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: formatCurrency(total_amount, "USD"),
    status: "Not Paid",
    detail: "Awaiting payment",
    client_type: client.client_type,
  };
}

function buildPastClientRow(entry: DashboardClientSummary): ClientListItem {
  const { client, total_amount } = entry;
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: formatCurrency(total_amount, "USD"),
    status: "Paid",
    detail: "No active reminders",
    client_type: client.client_type,
  };
}

function buildPaidClientRow(entry: DashboardPaidClient): ClientListItem {
  const latestPaid = entry.invoices
    .map((invoice) => invoice.paid_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const detail = `${entry.invoices.length} invoice${
    entry.invoices.length === 1 ? "" : "s"
  } · ${
    latestPaid ? `Paid ${formatDateShort(latestPaid)}` : "Settled this week"
  }`;
  const currency = entry.invoices[0]?.currency ?? "USD";
  return {
    id: entry.client.id,
    name: truncateName(entry.client.name),
    amount: formatCurrency(entry.total_paid, currency),
    status: "Paid",
    detail,
    client_type: entry.client.client_type,
  };
}

function truncateName(name: string) {
  if (name.length <= 14) return name;
  return `${name.slice(0, 11)}…`;
}

function formatCurrency(value: number, currency = "USD") {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateShort(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  errorText: {
    color: Theme.palette.accent,
  },
  filterPill: {
    flexDirection: "row",
    backgroundColor: Theme.palette.surface,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
  },
  filterContainer: {
    alignSelf: "flex-end",
  },
  filterButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: Theme.palette.slate,
  },
  filterLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  filterLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  summaryCaption: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  listCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  listCardMuted: {
    opacity: 0.85,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  listMeta: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  loadingState: {
    alignItems: "center",
    paddingVertical: Theme.spacing.md,
  },
  emptyText: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  clientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Theme.palette.border,
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  clientText: {
    flex: 1,
    gap: 4,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  clientTypeBadge: {
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: Theme.radii.sm,
    backgroundColor: Theme.palette.surface,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  clientTypeLabel: {
    fontSize: 11,
    color: Theme.palette.slate,
    textTransform: "capitalize",
  },
  clientDetail: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  clientAmounts: {
    alignItems: "flex-end",
    gap: 6,
  },
  clientAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
  },
  badgePaid: {
    borderColor: Theme.palette.success,
    backgroundColor: "rgba(47, 110, 79, 0.08)",
  },
  badgeDue: {
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  badgeLabelPaid: {
    color: Theme.palette.success,
  },
  badgeLabelDue: {
    color: Theme.palette.slate,
  },
});
