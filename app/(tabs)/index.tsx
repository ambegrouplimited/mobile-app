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

import type { ClientListItem } from "@/data/mock-clients";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import {
  buildOutstandingClientRow,
  buildPaidClientRow,
  buildPastClientRow,
  formatCurrency,
} from "@/lib/dashboard-clients";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchDashboardSummary,
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
  const limitedUnpaidClients = useMemo(
    () => unpaidClients.slice(0, 5),
    [unpaidClients]
  );
  const unpaidCount = unpaidClients.length;

  const paidClients = useMemo<ClientListItem[]>(() => {
    if (!summary) return [];
    return summary.paid_clients_this_week.map((entry) =>
      buildPaidClientRow(entry)
    );
  }, [summary]);
  const limitedPaidClients = useMemo(
    () => paidClients.slice(0, 5),
    [paidClients]
  );
  const paidCount = paidClients.length;

  const pastClientRows = useMemo<ClientListItem[]>(() => {
    if (!summary) return [];
    return summary.past_clients.map((entry) => buildPastClientRow(entry));
  }, [summary]);
  const limitedPastClients = useMemo(
    () => pastClientRows.slice(0, 5),
    [pastClientRows]
  );
  const pastClientsCount = pastClientRows.length;
  const showPastClientsSeeAll = pastClientsCount > 5;

  const showingNotPaid = filter === "Not Paid";
  const visibleClients = showingNotPaid
    ? limitedUnpaidClients
    : limitedPaidClients;
  const visibleTotalCount = showingNotPaid ? unpaidCount : paidCount;
  const showVisibleSeeAll = showingNotPaid
    ? unpaidCount > 5
    : paidCount > 5;

  const handleRefresh = useCallback(async () => {
    await loadSummary({ isRefreshing: true });
  }, [loadSummary]);

  const handleSeeAllUnpaid = useCallback(() => {
    router.push("/clients/not-paid");
  }, [router]);

  const handleSeeAllPaid = useCallback(() => {
    router.push("/clients/paid");
  }, [router]);

  const handleSeeAllPastClients = useCallback(() => {
    router.push("/past-clients");
  }, [router]);

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
          totalCount={visibleTotalCount}
          actionLabel={showVisibleSeeAll ? "See all" : undefined}
          onAction={
            showVisibleSeeAll
              ? showingNotPaid
                ? handleSeeAllUnpaid
                : handleSeeAllPaid
              : undefined
          }
          loading={loading && !refreshing && !summary}
          onPress={(id) => router.push(`/client/${id}`)}
        />
        <ClientList
          title="Past clients"
          clients={limitedPastClients}
          totalCount={pastClientsCount}
          actionLabel={showPastClientsSeeAll ? "See all" : undefined}
          onAction={showPastClientsSeeAll ? handleSeeAllPastClients : undefined}
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

export function ClientList({
  title,
  clients: list,
  muted,
  onPress,
  loading,
  actionLabel,
  onAction,
  totalCount,
}: {
  title: string;
  clients: ClientListItem[];
  muted?: boolean;
  onPress?: (id: string) => void;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  totalCount?: number;
}) {
  const showEmpty = !loading && list.length === 0;
  return (
    <View style={[styles.listCard, muted && styles.listCardMuted]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{title}</Text>
        <View style={styles.listHeaderRight}>
          <Text style={styles.listMeta}>
            {typeof totalCount === "number" ? totalCount : list.length} listed
          </Text>
          {actionLabel ? (
            <Pressable
              onPress={onAction}
              hitSlop={8}
              style={styles.listActionButton}
            >
              <Text style={styles.listActionLabel}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Theme.palette.slate} />
        </View>
      ) : showEmpty ? (
        <Text style={styles.emptyText}>No clients to show right now.</Text>
      ) : (
        list.map((client) => {
          const tone =
            client.status === "Paid"
              ? "paid"
              : client.status === "Partially Paid"
              ? "partial"
              : "due";
          const badgeStyle =
            tone === "paid"
              ? styles.badgePaid
              : tone === "partial"
              ? styles.badgePartial
              : styles.badgeDue;
          const labelStyle =
            tone === "paid"
              ? styles.badgeLabelPaid
              : tone === "partial"
              ? styles.badgeLabelPartial
              : styles.badgeLabelDue;
          const iconName =
            tone === "paid"
              ? "check-circle"
              : tone === "partial"
              ? "pie-chart"
              : "alert-circle";
          const iconColor =
            tone === "paid" ? Theme.palette.success : Theme.palette.slate;
          return (
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
                <View style={[styles.badge, badgeStyle]}>
                  <Feather name={iconName} size={14} color={iconColor} />
                  <Text style={[styles.badgeLabel, labelStyle]}>
                    {client.status}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
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
    flexWrap: "wrap",
    gap: Theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
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
    alignItems: "center",
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  listHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  listMeta: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  listActionButton: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
  },
  listActionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.slate,
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
  badgePartial: {
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.1)",
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
  badgeLabelPartial: {
    color: Theme.palette.slate,
  },
  badgeLabelDue: {
    color: Theme.palette.slate,
  },
});
