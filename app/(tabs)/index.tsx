import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
  type CurrencyDisplayMode,
  formatCurrency,
} from "@/lib/dashboard-clients";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchDashboardSummary,
  type CurrencyTotal,
  type DashboardSummary,
} from "@/services/dashboard";

const FILTERS = ["Not Paid", "Paid"] as const;
const DASHBOARD_CACHE_KEY = "cache.dashboard.summary";

export default function DashboardScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Not Paid");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = useMemo(() => {
    if (user?.name?.trim()) {
      return user.name.trim().split(" ")[0];
    }
    if (user?.email?.trim()) {
      return user.email.trim().split("@")[0];
    }
    return "there";
  }, [user?.name, user?.email]);
  const avatarUri = (user as { avatarUrl?: string } | undefined)?.avatarUrl;
  const avatarInitial = useMemo(() => {
    if (user?.name?.trim()) {
      return user.name.trim().charAt(0).toUpperCase();
    }
    if (user?.email?.trim()) {
      return user.email.trim().charAt(0).toUpperCase();
    }
    return "D";
  }, [user?.name, user?.email]);
  const openSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);
  const navigateToClient = useCallback(
    (clientId: string, meta?: { invoiceIds?: string[] }) => {
      const invoiceParam =
        meta?.invoiceIds && meta.invoiceIds.length
          ? { invoiceIds: meta.invoiceIds.join(",") }
          : undefined;
      router.push({
        pathname: `/client/${clientId}`,
        params: invoiceParam,
      });
    },
    [router]
  );
  const [metricsCurrencyMode, setMetricsCurrencyMode] =
    useState<CurrencyDisplayMode>("display");

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

  const displayCurrencyCode = useMemo(() => {
    const candidates = [
      summary?.metrics?.total_outstanding?.display?.currency,
      summary?.metrics?.total_paid_this_week?.display?.currency,
      summary?.not_paid_clients?.[0]?.amounts?.display_total?.currency,
      summary?.paid_clients?.[0]?.amounts?.display_total?.currency,
      summary?.past_clients?.[0]?.amounts?.display_total?.currency,
    ]
      .map((code) => code?.toUpperCase())
      .filter(Boolean) as string[];
    return candidates[0] ?? "USD";
  }, [summary]);

  const metricCurrencyOptions = useMemo(() => {
    const isDisplayUsd = displayCurrencyCode === "USD";
    const displayLabel = isDisplayUsd
      ? "USD (Display)"
      : displayCurrencyCode;
    return [
      { value: "display", label: displayLabel },
      { value: "usd", label: "USD" },
    ];
  }, [displayCurrencyCode]);

  const summaryStats = useMemo(() => {
    const metrics = summary?.metrics;
    return [
      {
        label: "Outstanding",
        value: formatMetricTotal(
          metrics?.total_outstanding,
          metricsCurrencyMode
        ),
        caption: metrics
          ? `${metrics.clients_waiting_payment} client${
              metrics.clients_waiting_payment === 1 ? "" : "s"
            } awaiting payment`
          : "Awaiting new reminders",
      },
      {
        label: "Paid this week",
        value: formatMetricTotal(
          metrics?.total_paid_this_week,
          metricsCurrencyMode
        ),
        caption: metrics
          ? `${metrics.clients_paid_this_week} client${
              metrics.clients_paid_this_week === 1 ? "" : "s"
            } settled`
          : "No payments recorded",
      },
    ];
  }, [summary, metricsCurrencyMode]);

  const unpaidClients = useMemo<ClientListItem[]>(() => {
    if (!summary?.not_paid_clients) return [];
    return summary.not_paid_clients.map((entry) =>
      buildOutstandingClientRow(entry)
    );
  }, [summary]);
  const limitedUnpaidClients = useMemo(
    () => unpaidClients.slice(0, 5),
    [unpaidClients]
  );
  const unpaidCount = unpaidClients.length;

  const paidClients = useMemo<ClientListItem[]>(() => {
    if (!summary?.paid_clients) return [];
    return summary.paid_clients.map((entry) =>
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
    return summary.past_clients.map((entry) =>
      buildPastClientRow(entry)
    );
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
        <View style={styles.greetingRow}>
          <Pressable
            style={styles.avatarButton}
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <View style={styles.avatarCircle}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              )}
            </View>
          </Pressable>
          <View style={styles.greetingCopy}>
            <Text style={styles.greetingLabel}>Welcome back</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
          </View>
        </View>
        <View style={styles.summaryControls}>
          <View style={styles.currencySelectorRow}>
            <Text style={styles.currencySelectorLabel}>Show totals in</Text>
            <CurrencyDropdown
              value={metricsCurrencyMode}
              options={metricCurrencyOptions}
              onChange={(value) =>
                setMetricsCurrencyMode(value as CurrencyDisplayMode)
              }
            />
          </View>
        </View>
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
          onPress={navigateToClient}
        />
        <ClientList
          title="Past clients"
          clients={limitedPastClients}
          totalCount={pastClientsCount}
          actionLabel={showPastClientsSeeAll ? "See all" : undefined}
          onAction={showPastClientsSeeAll ? handleSeeAllPastClients : undefined}
          muted
          loading={loading && !refreshing && !summary}
          onPress={navigateToClient}
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
  onPress?: (
    id: string,
    meta?: { invoiceParams?: Record<string, string> }
  ) => void;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  totalCount?: number;
}) {
  const [clientCurrencySelections, setClientCurrencySelections] = useState<
    Record<string, string>
  >({});
  const showEmpty = !loading && list.length === 0;

  const handleClientCurrencyChange = useCallback(
    (id: string, value: string) => {
      setClientCurrencySelections((prev) => {
        if (prev[id] === value) {
          return prev;
        }
        return { ...prev, [id]: value };
      });
    },
    []
  );

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
          const dropdownOptions =
            client.amount_options?.map((option) => ({
              value: option.id,
              label: option.label,
            })) ?? [];
          const defaultSelection = dropdownOptions[0]?.value;
          const selectedId =
            clientCurrencySelections[client.id] ?? defaultSelection;
          const selectedAmount =
            client.amount_options?.find((option) => option.id === selectedId) ??
            client.amount_options?.[0];
          const amountDisplay = selectedAmount
            ? formatCurrency(selectedAmount.amount, selectedAmount.currency)
            : client.amount;
          return (
            <Pressable
              key={client.id}
              style={styles.clientRow}
              onPress={() => onPress?.(client.id, client.meta)}
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
                <Text style={styles.clientAmount}>{amountDisplay}</Text>
                {dropdownOptions.length ? (
                  <CurrencyDropdown
                    value={selectedId ?? dropdownOptions[0].value}
                    options={dropdownOptions}
                    onChange={(value) =>
                      handleClientCurrencyChange(client.id, value)
                    }
                    variant="inline"
                  />
                ) : null}
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

type CurrencyOption = { value: string; label: string };

function CurrencyDropdown({
  value,
  options,
  onChange,
  variant = "default",
}: {
  value: string;
  options: CurrencyOption[];
  onChange: (mode: string) => void;
  variant?: "default" | "inline";
}) {
  const [visible, setVisible] = useState(false);
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const canToggle = options.length > 1;

  const handleSelect = (mode: string) => {
    setVisible(false);
    if (mode !== value) {
      onChange(mode);
    }
  };

  const buttonStyle =
    variant === "inline"
      ? styles.currencyDropdownButtonInline
      : styles.currencyDropdownButton;
  const textStyle =
    variant === "inline"
      ? styles.currencyDropdownTextInline
      : styles.currencyDropdownText;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          buttonStyle,
          !canToggle && styles.currencyDropdownButtonDisabled,
          pressed && canToggle && styles.currencyDropdownButtonPressed,
        ]}
        onPress={() => (canToggle ? setVisible(true) : undefined)}
        hitSlop={8}
      >
        <Text style={textStyle}>
          {selected?.label ?? value.toUpperCase()}
        </Text>
        {canToggle ? (
          <Feather name="chevron-down" size={14} color={Theme.palette.ink} />
        ) : null}
      </Pressable>
      <Modal
        transparent
        animationType="fade"
        visible={visible}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.currencyDropdownOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
          />
          <View style={styles.currencyDropdownMenu}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.currencyDropdownOption,
                    active && styles.currencyDropdownOptionActive,
                    pressed && styles.currencyDropdownOptionPressed,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.currencyDropdownOptionText,
                      active && styles.currencyDropdownOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatMetricTotal(
  total?: CurrencyTotal,
  mode: CurrencyDisplayMode = "display"
) {
  if (!total) {
    return "—";
  }
  if (mode === "usd") {
    return formatCurrency(total.usd ?? 0, "USD");
  }
  const display = total.display;
  if (display) {
    return formatCurrency(display.amount, display.currency);
  }
  return formatCurrency(total.usd ?? 0, "USD");
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
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  avatarButton: {
    borderRadius: 28,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  greetingCopy: {
    gap: 2,
  },
  greetingLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  greetingName: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
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
  summaryControls: {
    alignItems: "flex-end",
  },
  currencySelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  currencySelectorLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  currencyDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Theme.palette.surface,
    overflow: "hidden",
  },
  currencyDropdownButtonPressed: {
    backgroundColor: "rgba(28, 31, 35, 0.06)",
  },
  currencyDropdownButtonDisabled: {
    opacity: 0.6,
  },
  currencyDropdownText: {
    fontSize: 13,
    color: Theme.palette.ink,
    fontWeight: "500",
  },
  currencyDropdownButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 2,
    overflow: "hidden",
  },
  currencyDropdownTextInline: {
    fontSize: 12,
    color: Theme.palette.slate,
    fontWeight: "500",
  },
  currencyDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 22, 32, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  currencyDropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderRadius: Theme.radii.lg,
    paddingVertical: 4,
    width: 200,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
  },
  currencyDropdownOption: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  currencyDropdownOptionActive: {
    backgroundColor: Theme.palette.surface,
  },
  currencyDropdownOptionPressed: {
    backgroundColor: "rgba(28, 31, 35, 0.08)",
  },
  currencyDropdownOptionText: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  currencyDropdownOptionTextActive: {
    fontWeight: "600",
  },
});
