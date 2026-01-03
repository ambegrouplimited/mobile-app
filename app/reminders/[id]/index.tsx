import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { reminderDetails } from "@/data/mock-reminders";

const actions = [
  { icon: "refresh-cw", title: "Past deliveries", detail: "History & delivery status", href: "/reminders/[id]/history" },
  { icon: "file-text", title: "Reminder summary", detail: "Tone, schedule, payment", href: "/reminders/[id]/summary" },
] as const;

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function formatHeaderAmount(amount?: string, currency?: string | null) {
  if (!amount) {
    return undefined;
  }
  if (/[A-Za-z$€£¥₹₦₽₱₴₭₮₩]/.test(amount)) {
    return amount;
  }
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

export default function ReminderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    client?: string;
    amount?: string;
    status?: string;
    nextAction?: string;
    schedule?: string;
    invoiceId?: string | string[];
    clientId?: string | string[];
    platform?: string | string[];
    currency?: string | string[];
  }>();
  const id = getParam(params.id);
  const reminder = id ? reminderDetails[id] : undefined;
  const paramClient = getParam(params.client);
  const paramAmount = getParam(params.amount);
  const paramStatus = getParam(params.status);
  const paramNextAction = getParam(params.nextAction);
  const paramSchedule = getParam(params.schedule);
  const invoiceId = getParam(params.invoiceId);
  const clientId = getParam(params.clientId);
  const platform = getParam(params.platform);
  const paramCurrency = getParam(params.currency);
  const headerClient = paramClient ?? reminder?.client;
  const headerAmount = paramAmount ? formatHeaderAmount(paramAmount, paramCurrency) : reminder?.amount;
  const headerStatus = paramStatus ?? reminder?.status;
  const headerNextAction = paramNextAction ?? reminder?.nextAction;
  const headerSchedule = paramSchedule ?? reminder?.scheduleMode;
  const hasPrefill =
    Boolean(paramClient) ||
    Boolean(paramAmount) ||
    Boolean(paramStatus) ||
    Boolean(paramNextAction) ||
    Boolean(paramSchedule);

  const handleActionPress = (href?: string) => {
    if (!href || !id) {
      return;
    }
    const nextParams: Record<string, string> = { id };
    if (invoiceId) nextParams.invoiceId = invoiceId;
    if (clientId) nextParams.clientId = clientId;
    if (platform) nextParams.platform = platform;
    if (headerClient) nextParams.client = headerClient;
    if (paramAmount) nextParams.amount = paramAmount;
    if (paramCurrency) nextParams.currency = paramCurrency;
    if (headerStatus) nextParams.status = headerStatus;
    if (headerNextAction) nextParams.nextAction = headerNextAction;
    if (headerSchedule) nextParams.schedule = headerSchedule;
    router.push({
      pathname: href,
      params: nextParams,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminders</Text>
        </Pressable>

        {reminder || hasPrefill ? (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.clientName}>
                {headerClient ?? "Unnamed client"}
              </Text>
              {headerAmount ? (
                <Text style={styles.amount}>{headerAmount}</Text>
              ) : null}
              {headerStatus ? (
                <Text style={styles.status}>{headerStatus}</Text>
              ) : null}
              {headerNextAction ? (
                <Text style={styles.meta}>{headerNextAction}</Text>
              ) : null}
              {headerSchedule ? (
                <Text style={styles.meta}>{headerSchedule}</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Open actions</Text>
              <View style={styles.actionList}>
                {actions.map((action, index) => (
                  <Pressable
                    key={action.title}
                    style={[styles.actionItem, index === actions.length - 1 && styles.actionItemLast]}
                    onPress={() => handleActionPress(action.href)}
                  >
                    <View style={styles.actionIcon}>
                      <Feather name={action.icon} size={18} color={Theme.palette.slate} />
                    </View>
                    <View style={styles.actionText}>
                      <Text style={styles.actionTitle}>{action.title}</Text>
                      <Text style={styles.actionDetail}>{action.detail}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={Theme.palette.slateSoft} />
                  </Pressable>
                ))}
              </View>
            </View>
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
  headerCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: 6,
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
  status: {
    fontSize: 14,
    color: Theme.palette.slate,
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
  actionList: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  actionDetail: {
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
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  placeholderDetail: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
