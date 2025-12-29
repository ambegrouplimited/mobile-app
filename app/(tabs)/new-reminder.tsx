import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { fetchClients } from "@/services/clients";
import type { Client, ContactMethod } from "@/types/clients";

const CLIENT_TYPES = ["business", "individual"] as const;
const clientTypeLabels: Record<(typeof CLIENT_TYPES)[number], string> = {
  business: "Business",
  individual: "Individual",
};

export default function NewReminderScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [client, setClient] = useState("");
  const [clientType, setClientType] = useState<(typeof CLIENT_TYPES)[number]>("business");
  const [businessName, setBusinessName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [iosDatePickerVisible, setIosDatePickerVisible] = useState(false);
  const [iosDateValue, setIosDateValue] = useState(() => new Date());
  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [quickPickPending, setQuickPickPending] = useState<{ client: Client; method: ContactMethod } | null>(null);
  const [quickPickModalVisible, setQuickPickModalVisible] = useState(false);
  const [reopenQuickModalAfterPicker, setReopenQuickModalAfterPicker] = useState(false);
  const canSchedule = useMemo(() => Boolean(client.trim()) && Boolean(amount.trim()), [client, amount]);
  const missingQuickPickFields = useMemo(() => {
    const missing: string[] = [];
    if (!dueDate) missing.push("Due date");
    if (!notes.trim()) missing.push("Client notes");
    return missing;
  }, [dueDate, notes]);

  useEffect(() => {
    let cancelled = false;
    const loadClients = async () => {
      if (!session?.accessToken) {
        setSavedClients([]);
        setClientsError(null);
        return;
      }
      setClientsLoading(true);
      setClientsError(null);
      try {
        const response = await fetchClients(session.accessToken);
        if (!cancelled) {
          setSavedClients(response);
        }
      } catch (err) {
        if (!cancelled) {
          setClientsError(err instanceof Error ? err.message : "Unable to load clients right now.");
          setSavedClients([]);
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false);
        }
      }
    };
    loadClients();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  const proceedToSendOptions = useCallback(
    async (savedClient: Client, method: ContactMethod, platform: string) => {
      const contactSummary = getContactSummary(method);
      await Haptics.selectionAsync();
      router.push({
        pathname: "/new-reminder/send-options",
        params: {
          client: savedClient.name,
          clientType: savedClient.client_type,
          businessName: savedClient.company_name ?? "",
          amount: amount.trim(),
          dueDate,
          notes: notes.trim(),
          platform,
          mode: "self",
          contact: contactSummary,
          contactLabel: method.label ?? platform,
          clientId: savedClient.id,
          contactMethodId: method.id,
          contactPhone: method.phone ?? "",
          slackTeamId: method.slack_team_id ?? "",
          slackUserId: method.slack_user_id ?? "",
          telegramChatId: method.telegram_chat_id ?? "",
          telegramUsername: method.telegram_username ?? "",
        },
      });
    },
    [amount, dueDate, notes, router],
  );

  const handleUseSavedClient = useCallback(
    async (savedClient: Client, method: ContactMethod) => {
      if (!amount.trim()) {
        setScheduleError("Enter the amount owed before using a saved client.");
        return;
      }
      const platform = resolvePlatformFromMethod(method.type);
      if (!platform) {
        Alert.alert("Unsupported contact", "This contact type cannot be used yet.");
        return;
      }
      if (missingQuickPickFields.length > 0) {
        setQuickPickPending({ client: savedClient, method });
        setQuickPickModalVisible(true);
        return;
      }
      proceedToSendOptions(savedClient, method, platform);
    },
    [amount, missingQuickPickFields.length, proceedToSendOptions],
  );

  const reopenQuickModalIfNeeded = () => {
    if (reopenQuickModalAfterPicker) {
      setQuickPickModalVisible(true);
      setReopenQuickModalAfterPicker(false);
    }
  };

  const openDueDatePicker = (options?: { reopenQuick?: boolean }) => {
    const initial = dueDate ? parseISOToDate(dueDate) : new Date();
    if (options?.reopenQuick) {
      setQuickPickModalVisible(false);
      setReopenQuickModalAfterPicker(true);
    } else {
      setReopenQuickModalAfterPicker(false);
    }
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode: "date",
        value: initial,
        onChange: (event, date) => {
          if (event.type === "set" && date) {
            setDueDate(formatISODate(date));
          }
          if (event.type === "dismissed") {
            setIosDateValue(initial);
          }
          if (options?.reopenQuick) {
            reopenQuickModalIfNeeded();
          }
        },
      });
      return;
    }
    setIosDateValue(initial);
    setIosDatePickerVisible(true);
  };

  const closeIosDatePicker = () => {
    setIosDatePickerVisible(false);
    reopenQuickModalIfNeeded();
  };

  const confirmIOSDate = () => {
    setDueDate(formatISODate(iosDateValue));
    closeIosDatePicker();
  };

  const clearDueDate = () => {
    setDueDate("");
    setIosDateValue(new Date());
  };

  useEffect(() => {
    if (scheduleError && canSchedule) {
      setScheduleError(null);
    }
  }, [scheduleError, canSchedule]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.typeToggleBlock}>
          <View style={styles.typeTogglePill}>
            {CLIENT_TYPES.map((type) => {
              const active = clientType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setClientType(type)}
                  style={[styles.typeToggleButton, active && styles.typeToggleButtonActive]}
                >
                  <Text style={[styles.typeToggleText, active && styles.typeToggleTextActive]}>
                    {clientTypeLabels[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Client name</Text>
          <TextInput
            style={styles.input}
            placeholder="Acme Studio"
            placeholderTextColor={Theme.palette.slateSoft}
            value={client}
            onChangeText={setClient}
          />
          {clientType === "business" ? (
            <>
              <Text style={styles.label}>Business name</Text>
              <TextInput
                style={styles.input}
                placeholder="Company, LLC"
                placeholderTextColor={Theme.palette.slateSoft}
                value={businessName}
                onChangeText={setBusinessName}
              />
            </>
          ) : null}
          <Text style={styles.label}>Amount owed</Text>
          <TextInput
            style={styles.input}
            placeholder="$4,200"
            keyboardType="decimal-pad"
            placeholderTextColor={Theme.palette.slateSoft}
            value={amount}
            onChangeText={setAmount}
          />
          <View style={styles.dueDateHeader}>
            <Text style={styles.label}>Due date</Text>
            <Text style={styles.optional}>Optional</Text>
          </View>
          <Pressable style={styles.dateButton} onPress={openDueDatePicker}>
            <View style={styles.dateButtonContent}>
              <Feather name="calendar" size={18} color={Theme.palette.slate} />
              <Text style={[styles.dateButtonText, !dueDate && styles.dateButtonPlaceholder]}>
                {dueDate ? formatDueDateLabel(dueDate) : "Add a due date"}
              </Text>
            </View>
            {dueDate ? (
              <Pressable
                hitSlop={8}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  clearDueDate();
                }}
                style={styles.clearDate}
              >
                <Text style={styles.clearDateText}>Clear</Text>
              </Pressable>
            ) : null}
          </Pressable>
          <View style={[styles.dueDateHeader, styles.notesHeader]}>
            <Text style={styles.label}>Client notes</Text>
            <Text style={styles.optional}>Optional</Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Add context, project references, or preferences."
            placeholderTextColor={Theme.palette.slateSoft}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={[styles.primaryButton, !canSchedule && styles.primaryButtonDisabled]}
          disabled={!canSchedule}
          onPress={async () => {
            if (!canSchedule) {
              setScheduleError("Enter the client name and amount before continuing.");
              return;
            }
            setScheduleError(null);
            await Haptics.selectionAsync();
            router.push({
              pathname: "/new-reminder/contact-platform",
              params: {
                client: client.trim(),
                clientType,
                businessName: clientType === "business" ? businessName.trim() : "",
                amount: amount.trim(),
                notes: notes.trim(),
                ...(dueDate ? { dueDate } : {}),
              },
            });
          }}
        >
          <Feather name="plus-circle" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Schedule reminder</Text>
        </Pressable>
        {scheduleError ? <Text style={styles.errorText}>{scheduleError}</Text> : null}

        {renderSavedClients({
          clients: savedClients,
          loading: clientsLoading,
          error: clientsError,
          onSelect: handleUseSavedClient,
        })}
      </ScrollView>
      <Modal transparent visible={quickPickModalVisible} animationType="fade">
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalCard}>
            <Text style={styles.quickModalTitle}>Missing details</Text>
            <Text style={styles.quickModalSubtitle}>
              {missingQuickPickFields.join(" and ")} {missingQuickPickFields.length > 1 ? "are" : "is"} empty. Add them here or skip.
            </Text>
            <View style={styles.quickFieldGroup}>
              <Text style={styles.fieldLabel}>Due date</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => openDueDatePicker({ reopenQuick: true })}
              >
                <View style={styles.dateButtonContent}>
                  <Feather name="calendar" size={18} color={Theme.palette.slate} />
                  <Text style={[styles.dateButtonText, !dueDate && styles.dateButtonPlaceholder]}>
                    {dueDate ? formatDueDateLabel(dueDate) : "Add a due date"}
                  </Text>
                </View>
              </Pressable>
            </View>
            <View style={styles.quickFieldGroup}>
              <Text style={styles.fieldLabel}>Client notes</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Add context, project references, or preferences."
                placeholderTextColor={Theme.palette.slateSoft}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.quickActions}>
              <Pressable
                style={styles.quickActionMuted}
                onPress={() => {
                  setReopenQuickModalAfterPicker(false);
                  if (quickPickPending) {
                    const platform = resolvePlatformFromMethod(quickPickPending.method.type);
                    if (!platform) {
                      Alert.alert("Unsupported contact", "This contact type cannot be used yet.");
                      return;
                    }
                    proceedToSendOptions(quickPickPending.client, quickPickPending.method, platform);
                  }
                  setQuickPickModalVisible(false);
                  setQuickPickPending(null);
                }}
              >
                <Text style={styles.quickActionMutedText}>Skip</Text>
              </Pressable>
              <Pressable
                style={styles.quickActionPrimary}
                onPress={() => {
                  setReopenQuickModalAfterPicker(false);
                  if (quickPickPending) {
                    const platform = resolvePlatformFromMethod(quickPickPending.method.type);
                    if (!platform) {
                      Alert.alert("Unsupported contact", "This contact type cannot be used yet.");
                      return;
                    }
                    proceedToSendOptions(quickPickPending.client, quickPickPending.method, platform);
                  }
                  setQuickPickModalVisible(false);
                  setQuickPickPending(null);
                }}
              >
                <Text style={styles.quickActionPrimaryText}>Save & continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {Platform.OS === "ios" && iosDatePickerVisible ? (
        <Modal animationType="fade" transparent visible>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerBody}>
                <DateTimePicker
                  value={iosDateValue}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  textColor={Theme.palette.ink}
                  onChange={(_, next) => next && setIosDateValue(next)}
                />
              </View>
              <View style={styles.pickerActions}>
                <Pressable style={[styles.pickerButton, styles.pickerButtonMuted]} onPress={closeIosDatePicker}>
                  <Text style={styles.pickerButtonMutedText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.pickerButton} onPress={confirmIOSDate}>
                  <Text style={styles.pickerButtonText}>Set date</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  label: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Theme.palette.slate,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 16,
    color: Theme.palette.ink,
    marginBottom: Theme.spacing.sm,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  typeToggleBlock: {
    gap: Theme.spacing.xs,
  },
  typeTogglePill: {
    flexDirection: "row",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    backgroundColor: Theme.palette.surface,
  },
  typeToggleButtonActive: {
    backgroundColor: Theme.palette.slate,
  },
  typeToggleText: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  typeToggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  dueDateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optional: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
  },
  dateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    flex: 1,
  },
  dateButtonText: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  dateButtonPlaceholder: {
    color: Theme.palette.slateSoft,
  },
  clearDate: {
    paddingVertical: 4,
    paddingHorizontal: Theme.spacing.xs,
  },
  clearDateText: {
    fontSize: 13,
    color: Theme.palette.slate,
    fontWeight: "500",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  pickerBody: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
  },
  pickerActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: Theme.palette.border,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  pickerButtonMuted: {
    borderRightWidth: 1,
    borderColor: Theme.palette.border,
  },
  pickerButtonMutedText: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  notesHeader: {
    marginTop: Theme.spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 15,
    color: Theme.palette.ink,
    minHeight: 96,
  },
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  savedSection: {
    gap: Theme.spacing.sm,
  },
  savedClientsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  savedClientsHint: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  savedClientsBadge: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  savedClientsList: {
    gap: Theme.spacing.sm,
  },
  savedClientCard: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
    backgroundColor: "#FFFFFF",
    gap: Theme.spacing.sm,
  },
  savedClientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  savedClientName: {
    fontSize: 16,
    fontWeight: "500",
    color: Theme.palette.ink,
  },
  savedClientMeta: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
    marginTop: Theme.spacing.xs,
  },
  contactRowInfo: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  contactDetail: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  savedClientsError: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  quickModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  quickModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  quickModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  quickModalSubtitle: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  quickFieldGroup: {
    gap: Theme.spacing.xs,
  },
  quickActions: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  quickActionMuted: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionMutedText: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  quickActionPrimary: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

function parseISOToDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part) || 0);
  return new Date(year, month - 1, day || 1);
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDueDateLabel(value: string) {
  if (!value) return "Add a due date";
  const date = parseISOToDate(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderSavedClients({
  clients,
  loading,
  error,
  onSelect,
}: {
  clients: Client[];
  loading: boolean;
  error: string | null;
  onSelect: (client: Client, method: ContactMethod) => void;
}) {
  if ((!clients.length && !loading && !error) || !onSelect) {
    return null;
  }
  return (
    <View style={styles.savedSection}>
      <View style={styles.savedClientHeader}>
        <Text style={styles.savedClientsTitle}>Use an existing client</Text>
        {loading ? <Text style={styles.savedClientsBadge}>Loading…</Text> : null}
      </View>
      <Text style={styles.savedClientsHint}>Tap any card to reuse its contact details.</Text>
      {error ? <Text style={styles.savedClientsError}>{error}</Text> : null}
      <View style={styles.savedClientsList}>
        {!loading && !error
          ? clients.slice(0, 4).map((client) => (
              <View key={client.id} style={styles.savedClientCard}>
                <View style={styles.savedClientHeader}>
                  <View>
                    <Text style={styles.savedClientName}>{client.name}</Text>
                    {client.company_name ? (
                      <Text style={styles.savedClientMeta}>{client.company_name}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.savedClientsBadge}>{client.contact_methods?.length ?? 0} contacts</Text>
                </View>
                {client.contact_methods?.length ? (
                  client.contact_methods.slice(0, 3).map((method) => (
                    <Pressable
                      key={method.id}
                      style={styles.contactRow}
                      onPress={() => onSelect(client, method)}
                    >
                      <View style={styles.contactRowInfo}>
                        <Text style={styles.contactLabel}>{method.label || formatMethodLabel(method)}</Text>
                        <Text style={styles.contactDetail}>{getContactSummary(method)}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={Theme.palette.slate} />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.savedClientMeta}>No contact methods yet.</Text>
                )}
              </View>
            ))
          : null}
      </View>
    </View>
  );
}

function formatMethodLabel(method: ContactMethod) {
  switch (method.type) {
    case "email":
      return "Email";
    case "email_gmail":
      return "Gmail";
    case "email_outlook":
      return "Outlook";
    case "whatsapp":
      return "WhatsApp";
    case "telegram":
      return "Telegram";
    case "slack":
      return "Slack";
    default:
      return "Contact";
  }
}

function resolvePlatformFromMethod(type: ContactMethod["type"]) {
  switch (type) {
    case "email":
    case "email_gmail":
      return "gmail";
    case "email_outlook":
      return "outlook";
    case "whatsapp":
      return "whatsapp";
    case "telegram":
      return "telegram";
    case "slack":
      return "slack";
    default:
      return null;
  }
}

function getContactSummary(method: ContactMethod) {
  if (method.email) return method.email;
  if (method.phone) return method.phone;
  if (method.telegram_username) return method.telegram_username;
  if (method.telegram_chat_id) return method.telegram_chat_id;
  if (method.slack_user_id) return `Slack ${method.slack_user_id}`;
  return method.label ?? "Contact";
}
