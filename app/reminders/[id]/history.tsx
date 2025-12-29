import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { reminderDetails } from "@/data/mock-reminders";

const formatDeliveryTimestamp = (iso: string) => {
  const date = new Date(iso);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()] ?? "";
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month} ${day} • ${hours}:${minutes} ${suffix}`;
};

export default function ReminderHistoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reminder = id ? reminderDetails[id] : undefined;
  const deliveries = reminder?.deliveries
    ? [...reminder.deliveries].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminder</Text>
        </Pressable>

        {reminder ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.sectionEyebrow}>Past reminders</Text>
              <Text style={styles.clientName}>{reminder.client}</Text>
              <Text style={styles.amount}>{reminder.amount}</Text>
              <Text style={styles.meta}>{reminder.scheduleMode}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deliveries</Text>
              {deliveries.length > 0 ? (
                <View style={styles.deliveryList}>
                  {deliveries.map((delivery) => (
                    <View key={delivery.id} style={styles.deliveryCard}>
                      <View style={styles.deliveryHeader}>
                        <Text style={styles.deliverySubject}>{delivery.subject}</Text>
                        <Text style={styles.deliveryStatus}>{delivery.status}</Text>
                      </View>
                      <View style={styles.deliveryMetaRow}>
                        <Feather name="clock" size={14} color={Theme.palette.slate} />
                        <Text style={styles.deliveryMeta}>
                          {formatDeliveryTimestamp(delivery.sentAt)} · {delivery.channel}
                        </Text>
                      </View>
                      <Text style={styles.deliverySummary}>{delivery.summary}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.placeholderCard}>
                  <Feather name="inbox" size={20} color={Theme.palette.slate} />
                  <Text style={styles.placeholderTitle}>No deliveries yet</Text>
                  <Text style={styles.placeholderDetail}>Reminder sends will appear here after they go out.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.placeholderCard}>
            <Feather name="alert-triangle" size={20} color={Theme.palette.slate} />
            <Text style={styles.placeholderTitle}>Reminder not found</Text>
            <Text style={styles.placeholderDetail}>Try returning to the reminders tab.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Go back</Text>
            </Pressable>
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
    color: Theme.palette.slate,
  },
  headerCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: 4,
  },
  sectionEyebrow: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  amount: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  meta: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  deliveryList: {
    gap: Theme.spacing.sm,
  },
  deliveryCard: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Theme.spacing.sm,
  },
  deliverySubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  deliveryStatus: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  deliveryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  deliveryMeta: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  deliverySummary: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  placeholderCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: "flex-start",
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  placeholderDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  primaryButton: {
    marginTop: Theme.spacing.sm,
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
