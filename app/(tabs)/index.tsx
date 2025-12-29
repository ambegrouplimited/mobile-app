import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";

import { Theme } from "@/constants/theme";
import { activeClients, pastClients, ClientListItem } from "@/data/mock-clients";

const summaryStats = [
  { label: "Outstanding", value: "$12,420", caption: "4 clients awaiting payment" },
  { label: "Paid this week", value: "$5,800", caption: "Invoice sequences closed" },
] as const;

const FILTERS = ["Not Paid", "Paid"] as const;

export default function DashboardScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Not Paid");
  const visibleClients = useMemo(() => activeClients.filter((client) => client.status === filter), [filter]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
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
                  style={[styles.filterButton, active && styles.filterButtonActive]}
                >
                  <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ClientList title={`${filter} clients`} clients={visibleClients} onPress={(id) => router.push(`/client/${id}`)} />
        <ClientList title="Past clients" clients={pastClients} muted onPress={(id) => router.push(`/client/${id}`)} />
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
}: {
  title: string;
  clients: ClientListItem[];
  muted?: boolean;
  onPress?: (id: string) => void;
}) {
  return (
    <View style={[styles.listCard, muted && styles.listCardMuted]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listMeta}>{list.length} listed</Text>
      </View>
      {list.map((client) => (
        <Pressable key={client.id} style={styles.clientRow} onPress={() => onPress?.(client.id)}>
          <View style={styles.clientText}>
            <View style={styles.clientNameRow}>
              <Text style={styles.clientName}>{client.name}</Text>
              <View style={styles.clientTypeBadge}>
                <Text style={styles.clientTypeLabel}>{typeLabels[client.client_type]}</Text>
              </View>
            </View>
            <Text style={styles.clientDetail}>{client.detail}</Text>
          </View>
          <View style={styles.clientAmounts}>
            <Text style={styles.clientAmount}>{client.amount}</Text>
            <View style={[styles.badge, client.status === "Paid" ? styles.badgePaid : styles.badgeDue]}>
              <Feather
                name={client.status === "Paid" ? "check-circle" : "alert-circle"}
                size={14}
                color={client.status === "Paid" ? Theme.palette.success : Theme.palette.slate}
              />
              <Text
                style={[
                  styles.badgeLabel,
                  client.status === "Paid" ? styles.badgeLabelPaid : styles.badgeLabelDue,
                ]}
              >
                {client.status}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
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
