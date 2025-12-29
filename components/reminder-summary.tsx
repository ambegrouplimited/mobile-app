import { StyleSheet, Text, View } from "react-native";

import { Theme } from "@/constants/theme";
import { getContactPlatformInfo } from "@/constants/contact-platforms";
import {
  ReminderScheduleSummary,
  ReminderSummaryData,
  ReminderSummaryPaymentField,
} from "@/types/reminders";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ReminderSummaryDetails({ data }: { data: ReminderSummaryData }) {
  const platformInfo = getContactPlatformInfo(data.contact.platform);
  const platformLabel = platformInfo.label || data.contact.platform || "Selected platform";
  const dispatchMode =
    data.contact.dispatchMode === "self" ? "Send as you" : "Send on your behalf";
  const contactLabel = platformLabel.toLowerCase().includes("mail") ? "Client email" : "Client contact";

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Client details</Text>
        <SummaryRow label="Client name" value={data.client.name || "Not provided"} />
        <SummaryRow label="Client type" value={data.client.type || "Not set"} />
        {data.client.businessName ? (
          <SummaryRow label="Business name" value={data.client.businessName} />
        ) : null}
        <SummaryRow label="Amount owed" value={data.client.amount || "Not provided"} />
        <SummaryRow label="Due date" value={formatHumanDate(data.client.dueDate ?? "")} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact & delivery</Text>
        <SummaryRow label="Platform" value={platformLabel} />
        <SummaryRow label="Dispatch mode" value={dispatchMode} />
        <SummaryRow label={contactLabel} value={data.contact.value || "Not provided"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment method</Text>
        {data.payment ? (
          <>
            <SummaryRow label="Method" value={data.payment.methodTitle ?? "—"} />
            <SummaryRow label="Variant" value={data.payment.variantLabel ?? "—"} />
            {(data.payment.fields ?? []).map((field: ReminderSummaryPaymentField) => (
              <SummaryRow key={field.label} label={field.label} value={field.value || "—"} />
            ))}
          </>
        ) : (
          <Text style={styles.placeholder}>No payment method selected.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        {renderScheduleSummary(data.schedule)}
      </View>
    </>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function renderScheduleSummary(schedule: ReminderScheduleSummary) {
  if (schedule.mode === "manual") {
    const entries = schedule.data?.entries ?? [];
    if (!entries.length) {
      return <Text style={styles.placeholder}>No manual dates added.</Text>;
    }
    return (
      <View style={styles.scheduleList}>
        {entries.map((entry, index) => (
          <View key={`${entry.date}-${index}`} style={styles.scheduleItem}>
            <Text style={styles.schedulePrimary}>
              {formatHumanDate(entry.date)} · {formatTimeLabel(entry.time)}
            </Text>
            <Text style={styles.scheduleSecondary}>Tone: {entry.tone}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (schedule.mode === "weekly") {
    return (
      <View style={styles.scheduleList}>
        <SummaryRow
          label="Weekdays"
          value={
            schedule.data?.days?.length
              ? schedule.data.days.map((day) => WEEKDAY_LABELS[day] ?? String(day)).join(", ")
              : "Not set"
          }
        />
        <SummaryRow label="Time of day" value={formatTimeLabel(schedule.data?.time ?? "")} />
        <SummaryRow label="Max reminders" value={String(schedule.data?.maxReminders ?? 0)} />
        <SummaryRow label="Tone sequence" value={(schedule.data?.tones ?? []).join(" → ")} />
      </View>
    );
  }

  return (
    <View style={styles.scheduleList}>
      <SummaryRow label="Frequency" value={`${schedule.data?.frequencyDays ?? 0} day(s)`} />
      <SummaryRow label="Start date" value={formatHumanDate(schedule.data?.startDate ?? "")} />
      <SummaryRow label="Start time" value={formatTimeLabel(schedule.data?.startTime ?? "")} />
      <SummaryRow label="Max reminders" value={String(schedule.data?.maxReminders ?? 0)} />
      <SummaryRow label="Tone sequence" value={(schedule.data?.tones ?? []).join(" → ")} />
    </View>
  );
}

export function formatHumanDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTimeLabel(value: string) {
  if (!value) return "Not set";
  const [hours, minutes] = value.split(":").map((v) => Number(v) || 0);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  summaryRow: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  placeholder: {
    fontSize: 14,
    color: Theme.palette.slateSoft,
  },
  scheduleList: {
    gap: Theme.spacing.xs,
  },
  scheduleItem: {
    padding: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    gap: 2,
  },
  schedulePrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  scheduleSecondary: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
});
