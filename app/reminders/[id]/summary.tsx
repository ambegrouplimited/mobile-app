import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReminderSummaryDetails } from "@/components/reminder-summary";
import { Theme } from "@/constants/theme";
import { reminderDetails } from "@/data/mock-reminders";

export default function ReminderSummaryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reminder = id ? reminderDetails[id] : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminder</Text>
        </Pressable>

        {reminder ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Reminder summary</Text>
              <Text style={styles.subtitle}>
                Reference the instructions, delivery platform, and payout details that power this reminder.
              </Text>
            </View>

            <ReminderSummaryDetails data={reminder.summary} />
          </>
        ) : (
          <View style={styles.placeholderCard}>
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
  header: {
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
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
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  placeholderDetail: {
    fontSize: 14,
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
