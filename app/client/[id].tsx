import { Feather } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BankBadge from "@/assets/iban.png";
import { Theme } from "@/constants/theme";
import {
  clientProfiles,
  ClientType,
  PaymentMethod,
  ReminderSchedule,
} from "@/data/mock-clients";
import { paymentLogos } from "@/data/payment-methods";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchClient } from "@/services/clients";
import { fetchInvoices } from "@/services/invoices";
import type { Client, ContactMethod } from "@/types/clients";
import type { Invoice } from "@/types/invoices";
import type {
  PaymentMethodDetails,
  PaymentMethodType,
} from "@/types/payment-methods";

type PaymentInstruction = PaymentMethodDetails;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CONTACT_LOGOS = {
  email: Asset.fromModule(require("@/assets/contactPlatforms/inbox.svg")).uri,
  whatsapp: Asset.fromModule(require("@/assets/contactPlatforms/whatsapp.svg"))
    .uri,
  telegram: Asset.fromModule(require("@/assets/contactPlatforms/telegram.svg"))
    .uri,
  slack: Asset.fromModule(require("@/assets/contactPlatforms/slack.svg")).uri,
} as const;

type PaymentLogoKey = keyof typeof paymentLogos;
const CLIENT_CACHE_KEY = (id: string) => `cache.client.${id}`;
const CLIENT_INVOICES_CACHE_KEY = (id: string) => `cache.client.${id}.invoices`;

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const reminders = useMemo(() => {
    if (id && clientProfiles[id]?.reminders?.length) {
      return clientProfiles[id].reminders;
    }
    const firstProfile = Object.values(clientProfiles)[0];
    return firstProfile ? firstProfile.reminders : [];
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const hydrate = async () => {
      const [cachedClient, cachedInvoices] = await Promise.all([
        getCachedValue<Client>(CLIENT_CACHE_KEY(id)),
        getCachedValue<Invoice[]>(CLIENT_INVOICES_CACHE_KEY(id)),
      ]);
      if (cancelled) return;
      if (cachedClient) setClient(cachedClient);
      if (cachedInvoices) setInvoices(cachedInvoices);
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const loadClient = async () => {
      if (!id || !session?.accessToken) {
        setClient(null);
        setInvoices([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [clientResult, invoiceResult] = await Promise.all([
          fetchClient(id, session.accessToken),
          fetchInvoices(session.accessToken, { client_id: id }),
        ]);
        setClient(clientResult);
        setInvoices(invoiceResult);
        await Promise.all([
          setCachedValue(CLIENT_CACHE_KEY(id), clientResult),
          setCachedValue(CLIENT_INVOICES_CACHE_KEY(id), invoiceResult),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this client right now."
        );
        setClient(null);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };
    loadClient();
  }, [id, session?.accessToken]);

  if (!id) {
    return <NotFoundState onBack={() => router.back()} />;
  }

  if (loading && !client) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Theme.palette.ink} />
          <Text style={styles.loadingText}>Loading client…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !client) {
    return (
      <NotFoundState
        onBack={() => router.back()}
        message={error ?? undefined}
      />
    );
  }

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
              <Text style={styles.clientTypeLabel}>
                {formatClientType(client.client_type)}
              </Text>
            </View>
          </View>
          {client.company_name ? (
            <Text style={styles.subtitle}>{client.company_name}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {client.contact_methods?.length ? (
            client.contact_methods.map((method) => (
              <ContactMethodRow key={method.id} method={method} />
            ))
          ) : (
            <Text style={styles.emptyDetail}>
              No contact methods saved yet.
            </Text>
          )}
          {client.notes ? <InfoRow label="Notes" value={client.notes} /> : null}
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
          {invoices.length === 0 ? (
            <Text style={styles.emptyDetail}>
              No reminders on record for this client.
            </Text>
          ) : (
            invoices.map((invoice) => (
              <View key={invoice.id} style={styles.reminderBlock}>
                <View style={styles.reminderHeader}>
                  <Text style={styles.reminderAmount}>
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </Text>
                  <Text style={styles.reminderStatus}>{invoice.status}</Text>
                </View>
                <Text style={styles.reminderDesc}>
                  {invoice.description || "No notes added."}
                </Text>
                <InfoRow
                  label="Due date"
                  value={formatFriendlyDate(invoice.due_date, true)}
                />
                <InfoRow
                  label="Delivery channel"
                  value={formatSendVia(invoice.send_via)}
                />
                {invoice.reminder_schedule ? (
                  <ScheduleDetails
                    schedule={invoice.reminder_schedule as ReminderSchedule}
                    dueDate={invoice.due_date || ""}
                  />
                ) : null}
                {invoice.payment_instructions?.length ? (
                  invoice.payment_instructions.map((instruction, idx) => (
                    <PaymentInstructionCard
                      key={`${invoice.id}-${instruction.type}-${idx}`}
                      instruction={instruction}
                    />
                  ))
                ) : reminders[0]?.payment_method ? (
                  <PaymentMethodCard method={reminders[0].payment_method} />
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactMethodRow({ method }: { method: ContactMethod }) {
  const icon = selectContactIcon(method);
  const value = formatContactValue(method);
  return (
    <View style={styles.contactRow}>
      {icon ? (
        <Image
          source={{ uri: icon }}
          style={styles.contactLogo}
          contentFit="contain"
        />
      ) : null}
      <View style={styles.contactText}>
        <Text style={styles.contactValue}>{value || "—"}</Text>
        <Text style={styles.contactLabel}>{formatContactLabel(method)}</Text>
      </View>
    </View>
  );
}

function NotFoundState({
  onBack,
  message,
}: {
  onBack: () => void;
  message?: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Client not found</Text>
        <Text style={styles.emptyDetail}>
          {message || "Try selecting a client from the dashboard."}
        </Text>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
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
  const name = channel.charAt(0).toUpperCase() + channel.slice(1);
  return `Sent as you from ${name}`;
}

function ScheduleDetails({
  schedule,
  dueDate,
}: {
  schedule: ReminderSchedule;
  dueDate?: string | null;
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

function PaymentInstructionCard({
  instruction,
}: {
  instruction: PaymentInstruction;
}) {
  const presentation = buildInstructionPresentation(instruction);
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

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  return <PaymentInstructionCard instruction={convertMockPayment(method)} />;
}

function convertMockPayment(method: PaymentMethod): PaymentInstruction {
  const base: PaymentInstruction = {
    type: method.kind as PaymentMethodType,
    label: method.label ?? formatTypeLabel(method.kind as PaymentMethodType),
    instructions: method.instructions ?? undefined,
  };
  if ("url" in method && method.url) {
    base.url = method.url;
  }
  if ("handle" in method && method.handle) {
    base.handle = method.handle;
  }
  if ("ach_bank_name" in method) {
    base.ach_bank_name = method.ach_bank_name;
    base.ach_account_number = method.ach_account_number;
    base.ach_routing_number = method.ach_routing_number;
    base.ach_account_type = method.ach_account_type;
  }
  if ("zelle_email" in method || "zelle_phone" in method) {
    base.zelle_email = method.zelle_email ?? undefined;
    base.zelle_phone = method.zelle_phone ?? undefined;
  }
  if ("iban" in method) {
    base.iban = method.iban;
    base.bic = method.bic;
  }
  if ("wallet_address" in method) {
    base.wallet_address = method.wallet_address;
    base.wallet_network = method.wallet_network;
    base.wallet_memo = method.wallet_memo;
  }
  if ("account_name" in method) {
    base.account_name = method.account_name;
  }
  return base;
}

function buildInstructionPresentation(
  instruction: PaymentInstruction
): PaymentPresentation {
  const title = instruction.label || formatTypeLabel(instruction.type);
  const subtitle = instruction.label
    ? formatTypeLabel(instruction.type)
    : undefined;
  const note = instruction.instructions ?? undefined;
  const rows: PaymentDetailRow[] = [];

  pushRow(rows, "Account name", instruction.account_name);

  switch (instruction.type) {
    case "stripe_link":
    case "paypal_link":
    case "venmo_link":
    case "cashapp_link":
    case "revolut_link":
    case "wise_link":
      pushRow(rows, "Payment link", instruction.url);
      break;
    case "paypal_handle":
    case "venmo_handle":
    case "cashapp_handle":
      pushRow(rows, "Handle", instruction.handle);
      break;
    case "ach":
      pushRow(rows, "Bank", instruction.ach_bank_name);
      pushRow(rows, "Account", instruction.ach_account_number);
      pushRow(rows, "Routing number", instruction.ach_routing_number);
      pushRow(rows, "Account type", instruction.ach_account_type);
      break;
    case "zelle":
      pushRow(rows, "Email", instruction.zelle_email);
      pushRow(rows, "Phone", instruction.zelle_phone);
      break;
    case "sepa":
      pushRow(rows, "IBAN", instruction.iban);
      pushRow(rows, "BIC", instruction.bic);
      break;
    case "revolut_account":
    case "wise_account":
    case "n26_account":
      pushRow(rows, "IBAN", instruction.iban);
      pushRow(rows, "BIC", instruction.bic);
      break;
    case "crypto_xrp":
    case "crypto_btc":
    case "crypto_eth":
    case "crypto_usdc":
    case "crypto_usdt":
    case "crypto_sol":
    case "crypto_bnb":
    case "crypto_doge":
    case "crypto_avax":
    case "crypto_tron":
    case "crypto_ton":
    case "crypto_monero":
    case "crypto_other":
      pushRow(rows, "Wallet address", instruction.wallet_address);
      pushRow(rows, "Network", instruction.wallet_network);
      pushRow(rows, "Memo / Tag", instruction.wallet_memo);
      break;
    case "custom":
      pushRow(rows, "Instructions", instruction.instructions);
      break;
    default:
      break;
  }

  return {
    title,
    subtitle,
    rows:
      rows.length > 0 ? rows : [{ label: "Instructions", value: note || "—" }],
    note,
    logo: instructionLogoForType(instruction.type),
  };
}

function pushRow(
  rows: PaymentDetailRow[],
  label: string,
  value?: string | null
) {
  if (!value) return;
  rows.push({ label, value });
}

function instructionLogoForType(type: PaymentMethodType): PaymentLogoKey {
  if (type.startsWith("crypto_")) {
    const key = type.replace("crypto_", "") as PaymentLogoKey;
    return key in paymentLogos ? key : "btc";
  }
  switch (type) {
    case "stripe_link":
      return "stripe";
    case "paypal_link":
    case "paypal_handle":
      return "paypal";
    case "venmo_link":
    case "venmo_handle":
      return "venmo";
    case "cashapp_link":
    case "cashapp_handle":
      return "cashapp";
    case "revolut_link":
    case "revolut_account":
      return "revolut";
    case "wise_link":
    case "wise_account":
      return "wise";
    case "n26_account":
      return "n26";
    case "zelle":
      return "zelle";
    case "sepa":
      return "iban";
    case "ach":
      return "bank";
    default:
      return "bank";
  }
}

function formatTypeLabel(type: PaymentMethodType) {
  if (type.startsWith("crypto_")) {
    return type.replace("crypto_", "").toUpperCase() + " wallet";
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function PaymentLogo({ logo }: { logo: PaymentLogoKey }) {
  const uri = paymentLogos[logo];
  const source = uri ? { uri } : BankBadge;
  return (
    <Image source={source} style={styles.paymentLogo} contentFit="contain" />
  );
}

function formatClientType(value: ClientType) {
  return value === "individual" ? "Individual" : "Business";
}

function formatContactPlatform(type: ContactMethod["type"]) {
  switch (type) {
    case "email":
    case "email_gmail":
    case "email_outlook":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "telegram":
      return "Telegram";
    case "slack":
      return "Slack";
    default:
      return type;
  }
}

function selectContactIcon(method: ContactMethod) {
  if (method.type === "whatsapp") return CONTACT_LOGOS.whatsapp;
  if (method.type === "telegram") return CONTACT_LOGOS.telegram;
  if (method.type === "slack") return CONTACT_LOGOS.slack;
  if (
    method.type === "email" ||
    method.type === "email_gmail" ||
    method.type === "email_outlook"
  ) {
    return CONTACT_LOGOS.email;
  }
  return null;
}

function formatContactValue(method: ContactMethod) {
  switch (method.type) {
    case "email":
    case "email_gmail":
    case "email_outlook":
      return method.email;
    case "whatsapp":
      return method.phone;
    case "telegram":
      return method.telegram_username || method.telegram_chat_id;
    case "slack":
      return method.slack_user_id
        ? `${method.slack_user_id}`
        : method.slack_team_id;
    default:
      return method.email || method.phone || "";
  }
}

function formatContactLabel(method: ContactMethod) {
  const isEmail =
    method.type === "email" ||
    method.type === "email_gmail" ||
    method.type === "email_outlook";
  if (isEmail) {
    return "Email contact";
  }
  return method.label || formatContactPlatform(method.type);
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

function formatFriendlyDate(value?: string | null, long?: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

function formatCurrency(amount: number, currency = "USD") {
  const value = Number(amount);
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
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
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  loadingText: {
    color: Theme.palette.slate,
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
  contactRow: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  contactLogo: {
    width: 28,
    height: 28,
  },
  contactText: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  contactValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  contactTag: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    color: Theme.palette.slate,
    fontSize: 12,
  },
});
