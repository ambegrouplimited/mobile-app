import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { reminderDrafts, upcomingReminders } from "@/data/mock-reminders";

export default function RemindersScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <View style={styles.list}>
            {upcomingReminders.map((item) => (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/reminders/[id]",
                    params: { id: item.id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardClient}>{item.client}</Text>
                  <Text style={styles.cardAmount}>{item.amount}</Text>
                </View>
                <View style={styles.row}>
                  <Feather name="mail" size={16} color={Theme.palette.slate} />
                  <Text style={styles.cardStatus}>{item.status}</Text>
                </View>
                <Text style={styles.cardNext}>{item.nextAction}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drafts</Text>
          <View style={styles.list}>
            {reminderDrafts.map((item) => (
              <View key={item.id} style={[styles.card, styles.cardDraft]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardClient}>{item.client}</Text>
                  <Text style={styles.cardAmount}>{item.amount}</Text>
                </View>
                <View style={styles.row}>
                  <Feather name="edit-3" size={16} color={Theme.palette.slate} />
                  <Text style={styles.cardStatus}>{item.status}</Text>
                </View>
                <Text style={styles.cardNext}>{item.next}</Text>
              </View>
            ))}
          </View>
        </View>
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
    gap: Theme.spacing.md,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  list: {
    gap: Theme.spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardClient: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  cardStatus: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  cardNext: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  cardDraft: {
    borderStyle: "dashed",
    borderColor: Theme.palette.border,
  },
});
