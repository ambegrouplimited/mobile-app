import { Feather } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import {
  ClientType,
  clientProfiles,
  PaymentMethod,
  ReminderSchedule,
} from "@/data/mock-clients";

import BankBadge from "@/assets/iban.png";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PAYMENT_LOGO_URIS = {
  stripe: Asset.fromModule(require("@/assets/stripe.svg")).uri,
  paypal: Asset.fromModule(require("@/assets/paypal.svg")).uri,
  venmo: Asset.fromModule(require("@/assets/venmo.svg")).uri,
  cashapp: Asset.fromModule(require("@/assets/cashapp.svg")).uri,
  revolut: Asset.fromModule(require("@/assets/revolut.svg")).uri,
  wise: Asset.fromModule(require("@/assets/wise.svg")).uri,
  zelle: Asset.fromModule(require("@/assets/zelle.svg")).uri,
  n26: Asset.fromModule(require("@/assets/n26.svg")).uri,
  bank: null,
} as const;

type PaymentLogoKey = keyof typeof PAYMENT_LOGO_URIS;

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = id ? clientProfiles[id] : undefined;

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Client not found</Text>
          <Text style={styles.emptyDetail}>
            Try selecting a client from the dashboard.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { client, reminders } = profile;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Clients</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Text style={styles.title}>{client.name}</Text>
            <View style={styles.clientTypeBadge}>
              <Text style={styles.clientTypeLabel}>{formatClientType(client.client_type)}</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>{client.company_name}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <InfoRow label="Email" value={client.email} />
          <InfoRow label="Phone" value={client.phone} />
          <InfoRow label="Notes" value={client.notes || "—"} />
          <InfoRow
            label="Added"
            value={new Date(client.created_at).toLocaleDateString()}
          />
          <InfoRow
            label="Last updated"
            value={new Date(client.updated_at).toLocaleDateString()}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          {reminders.length === 0 ? (
            <Text style={styles.emptyDetail}>
              No reminders on record for this client.
            </Text>
          ) : (
            reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderBlock}>
                <View style={styles.reminderHeader}>
                  <Text style={styles.reminderAmount}>
                    {reminder.currency} {reminder.amount.toLocaleString()}
                  </Text>
                  <Text style={styles.reminderStatus}>{reminder.status}</Text>
                </View>
                <Text style={styles.reminderDesc}>{reminder.description}</Text>
                <InfoRow
                  label="Due date"
                  value={formatFriendlyDate(reminder.due_date, true)}
                />
                <InfoRow
                  label="Delivery channel"
                  value={formatSendVia(reminder.send_via)}
                />
                <ScheduleDetails
                  schedule={reminder.reminder_schedule}
                  dueDate={reminder.due_date}
                />
                <PaymentMethodCard method={reminder.payment_method} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatSendVia(channel: string) {
  if (channel === "mailgun") {
    return "Sent on your behalf";
  }
  const normalized = channel.toLowerCase();
  const readable =
    normalized === "gmail" || normalized === "outlook"
      ? normalized
      : "your channel";
  return `Sent as you from ${readable}`;
}

function ScheduleDetails({
  schedule,
  dueDate,
}: {
  schedule: ReminderSchedule;
  dueDate: string;
}) {
  if (schedule.mode === "manual") {
    return (
      <View style={styles.scheduleBlock}>
        <Text style={styles.scheduleHeading}>Manual deliveries</Text>
        <View style={styles.manualList}>
          {schedule.manual_dates.map((date, index) => (
            <View key={date} style={styles.manualPill}>
              <Text style={styles.manualDate}>{formatFriendlyDate(date)}</Text>
              <Text style={styles.manualTime}>{formatTimeFromISO(date)}</Text>
              <ToneBadge tone={nextTone(schedule.tone_sequence, index)} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (schedule.mode === "weekly") {
    return (
      <View style={styles.scheduleBlock}>
        <Text style={styles.scheduleHeading}>Weekly pattern</Text>
        <View style={styles.weeklyRow}>
          {WEEKDAY_LABELS.map((day, index) => {
            const activeIndex = schedule.weekly_pattern.weekdays.indexOf(index);
            const active = activeIndex !== -1;
            return (
              <View
                key={day}
                style={[styles.weekdayChip, active && styles.weekdayChipActive]}
              >
                <Text
                  style={[
                    styles.weekdayLabel,
                    active && styles.weekdayLabelActive,
                  ]}
                >
                  {day}
                </Text>
                <View style={styles.weekdayToneSlot}>
                  {active ? (
                    <ToneBadge
                      tone={nextTone(schedule.tone_sequence, activeIndex)}
                      size="small"
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
        <InfoRow
          label="Send at"
          value={formatTime(schedule.weekly_pattern.time_of_day)}
        />
        {schedule.weekly_pattern.max_reminders ? (
          <InfoRow
            label="Max reminders"
            value={String(schedule.weekly_pattern.max_reminders)}
          />
        ) : null}
      </View>
    );
  }

  const cadence = schedule.cadence;
  return (
    <View style={styles.scheduleBlock}>
      <Text style={styles.scheduleHeading}>Cadence</Text>
      <View style={styles.cadenceColumn}>
        {nextCadenceDates(cadence, dueDate).map((date, index) => (
          <View key={date} style={styles.cadenceContent}>
            <Text style={styles.cadenceIndex}>Reminder #{index + 1}</Text>
            <Text style={styles.cadenceDate}>{formatFriendlyDate(date)}</Text>
            <View style={styles.cadenceFooter}>
              <Text style={styles.cadenceTime}>{formatTimeFromISO(date)}</Text>
              <ToneBadge tone={nextTone(schedule.tone_sequence, index)} />
            </View>
          </View>
        ))}
      </View>
      <InfoRow
        label="Frequency"
        value={`Every ${cadence.frequency_days} days`}
      />
    </View>
  );
}

type PaymentDetailRow = { label: string; value: string };
type PaymentPresentation = {
  title: string;
  subtitle?: string;
  rows: PaymentDetailRow[];
  note?: string;
  logo: PaymentLogoKey;
};

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  const presentation = buildPaymentPresentation(method);
  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLogoWrap}>
          <PaymentLogo logo={presentation.logo} />
        </View>
        <View style={styles.paymentTitleGroup}>
          <Text style={styles.paymentTitle}>{presentation.title}</Text>
          {presentation.subtitle ? (
            <Text style={styles.paymentSubtitle}>{presentation.subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.paymentDetails}>
        {presentation.rows.map((row) => (
          <View
            key={`${row.label}-${row.value}`}
            style={styles.paymentDetailRow}
          >
            <Text style={styles.paymentDetailLabel}>{row.label}</Text>
            <Text style={styles.paymentDetailValue}>{row.value}</Text>
          </View>
        ))}
      </View>
      {presentation.note ? (
        <Text style={styles.paymentNote}>{presentation.note}</Text>
      ) : null}
    </View>
  );
}

function buildPaymentPresentation(method: PaymentMethod): PaymentPresentation {
  const subtitle = "label" in method ? method.label : undefined;
  const note = method.instructions;
  switch (method.kind) {
    case "stripe_link":
      return {
        title: "Stripe link",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "stripe",
      };
    case "paypal_link":
      return {
        title: "PayPal checkout",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "paypal",
      };
    case "venmo_link":
      return {
        title: "Venmo link",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "venmo",
      };
    case "cashapp_link":
      return {
        title: "Cash App link",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "cashapp",
      };
    case "revolut_link":
      return {
        title: "Revolut link",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "revolut",
      };
    case "wise_link":
      return {
        title: "Wise link",
        subtitle,
        rows: [{ label: "Payment link", value: method.url }],
        note,
        logo: "wise",
      };
    case "paypal_handle":
      return {
        title: "PayPal handle",
        subtitle,
        rows: [{ label: "Handle", value: method.handle }],
        note,
        logo: "paypal",
      };
    case "venmo_handle":
      return {
        title: "Venmo handle",
        subtitle,
        rows: [{ label: "Handle", value: method.handle }],
        note,
        logo: "venmo",
      };
    case "cashapp_handle":
      return {
        title: "Cash App handle",
        subtitle,
        rows: [{ label: "Handle", value: method.handle }],
        note,
        logo: "cashapp",
      };
    case "ach": {
      const rows: PaymentDetailRow[] = [
        { label: "Bank", value: method.ach_bank_name },
        { label: "Account", value: method.ach_account_number },
        { label: "Routing number", value: method.ach_routing_number },
      ];
      if (method.ach_account_type) {
        rows.push({ label: "Account type", value: method.ach_account_type });
      }
      return {
        title: "ACH transfer",
        rows,
        note,
        logo: "bank",
      };
    }
    case "zelle": {
      const rows: PaymentDetailRow[] = [];
      if (method.zelle_email) {
        rows.push({ label: "Email", value: method.zelle_email });
      }
      if (method.zelle_phone) {
        rows.push({ label: "Phone", value: method.zelle_phone });
      }
      return {
        title: "Zelle",
        subtitle,
        rows,
        note,
        logo: "zelle",
      };
    }
    case "sepa": {
      const rows: PaymentDetailRow[] = [{ label: "IBAN", value: method.iban }];
      if (method.bic) {
        rows.push({ label: "BIC", value: method.bic });
      }
      return {
        title: "SEPA transfer",
        subtitle,
        rows,
        note,
        logo: "bank",
      };
    }
    case "revolut_account":
      return {
        title: "Revolut account",
        subtitle,
        rows: [
          { label: "IBAN", value: method.iban },
          { label: "BIC", value: method.bic },
        ],
        note,
        logo: "revolut",
      };
    case "wise_account":
      return {
        title: "Wise account",
        subtitle,
        rows: [
          { label: "IBAN", value: method.iban },
          { label: "BIC", value: method.bic },
        ],
        note,
        logo: "wise",
      };
    case "n26_account":
      return {
        title: "N26 account",
        subtitle,
        rows: [
          { label: "IBAN", value: method.iban },
          { label: "BIC", value: method.bic },
        ],
        note,
        logo: "n26",
      };
    default:
      return {
        title: "Payment method",
        rows: [],
        note,
        logo: "bank",
      };
  }
}

function PaymentLogo({ logo }: { logo: PaymentLogoKey }) {
  const uri = PAYMENT_LOGO_URIS[logo];
  const source = uri ? { uri } : BankBadge;
  return <Image source={source} style={styles.paymentLogo} contentFit="contain" />;
}

function formatClientType(value: ClientType) {
  return value === "individual" ? "Individual" : "Business";
}

function formatTime(value: string) {
  if (!value) return "—";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeFromISO(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFriendlyDate(value: string, long?: boolean) {
  const date = new Date(value);
  if (long) {
    return date.toLocaleDateString([], {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function nextCadenceDates(
  cadence: {
    frequency_days: number;
    start_date?: string;
    start_time: string;
    max_reminders: number;
  },
  dueDate: string
) {
  const dates: string[] = [];
  const base = cadence.start_date
    ? new Date(`${cadence.start_date}T${cadence.start_time}`)
    : new Date(dueDate);
  for (let i = 0; i < Math.min(3, cadence.max_reminders || 3); i += 1) {
    const next = new Date(base);
    next.setDate(base.getDate() + cadence.frequency_days * i);
    const [hour, minute] = cadence.start_time.split(":").map(Number);
    next.setHours(hour, minute, 0, 0);
    dates.push(next.toISOString());
  }
  return dates;
}

function nextTone(sequence: string[], index: number) {
  if (!sequence.length) {
    return "neutral";
  }
  return sequence[index % sequence.length];
}

function ToneBadge({
  tone,
  size = "regular",
}: {
  tone: string;
  size?: "regular" | "small";
}) {
  const { backgroundColor, color, label } = toneStyle(tone);
  return (
    <View
      style={[
        styles.toneBadge,
        size === "small" && styles.toneBadgeSmall,
        { backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.toneBadgeLabel,
          size === "small" && styles.toneBadgeLabelSmall,
          { color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function toneStyle(tone: string) {
  const normalized = tone?.toLowerCase() ?? "neutral";
  switch (normalized) {
    case "gentle":
      return {
        backgroundColor: "rgba(77, 94, 114, 0.16)",
        color: Theme.palette.ink,
        label: "Gentle",
      };
    case "firm":
      return {
        backgroundColor: "rgba(192, 135, 50, 0.15)",
        color: Theme.palette.accent,
        label: "Firm",
      };
    case "direct":
      return {
        backgroundColor: "rgba(28, 31, 35, 0.12)",
        color: Theme.palette.ink,
        label: "Direct",
      };
    default:
      return {
        backgroundColor: Theme.palette.surface,
        color: Theme.palette.slate,
        label: tone ?? "Neutral",
      };
  }
}

function formatToneLabel(tone?: string) {
  return toneStyle(tone ?? "Neutral").label;
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
  hero: {
    gap: 4,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 16,
    color: Theme.palette.inkMuted,
  },
  clientTypeBadge: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
  },
  clientTypeLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
    textTransform: "capitalize",
  },
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
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    color: Theme.palette.slate,
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  reminderBlock: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  scheduleBlock: {
    gap: Theme.spacing.xs,
  },
  scheduleHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  manualList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Theme.spacing.sm,
    marginVertical: Theme.spacing.sm,
  },
  manualPill: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Theme.palette.surface,
    minWidth: 120,
  },
  manualDate: {
    fontSize: 13,
    color: Theme.palette.ink,
  },
  manualTime: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  weeklyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  weekdayChip: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    width: 80,
    alignItems: "center",
    gap: 6,
  },
  weekdayChipActive: {
    backgroundColor: "rgba(77, 94, 114, 0.12)",
    borderColor: Theme.palette.slate,
  },
  weekdayLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  weekdayLabelActive: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  weekdayToneSlot: {
    minHeight: 22,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  cadenceColumn: {
    marginVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  cadenceContent: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.08)",
    padding: Theme.spacing.md,
    flex: 1,
    gap: Theme.spacing.xs,
  },
  cadenceIndex: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  cadenceDate: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  cadenceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Theme.spacing.xs,
  },
  cadenceTime: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  paymentCard: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.md,
    backgroundColor: Theme.palette.surface,
    gap: Theme.spacing.md,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  paymentLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentLogo: {
    width: 32,
    height: 32,
  },
  paymentTitleGroup: {
    flex: 1,
    gap: 2,
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  paymentSubtitle: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  paymentDetails: {
    gap: Theme.spacing.xs,
  },
  paymentDetailRow: {
    gap: 2,
  },
  paymentDetailLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  paymentDetailValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  paymentNote: {
    fontSize: 13,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  toneBadge: {
    borderRadius: Theme.radii.sm,
    paddingVertical: 2,
    paddingHorizontal: Theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  toneBadgeSmall: {
    paddingHorizontal: Theme.spacing.xxs,
    paddingVertical: 1,
    alignSelf: "center",
  },
  toneBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  toneBadgeLabelSmall: {
    fontSize: 10,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  reminderStatus: {
    fontSize: 13,
    color: Theme.palette.slate,
    textTransform: "capitalize",
  },
  reminderDesc: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  emptyDetail: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    textAlign: "center",
  },
  backButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  backButtonText: {
    color: Theme.palette.ink,
    fontSize: 15,
  },
});
