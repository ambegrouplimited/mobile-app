import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { MissingDetailsModal } from "@/components/new-reminder/MissingDetailsModal";
import { SavedClientsSection } from "@/components/new-reminder/SavedClientsSection";
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";
import { getContactSummary, resolvePlatformFromMethod } from "@/lib/contact-methods";
import { formatDueDateLabel, formatISODate, parseISOToDate } from "@/lib/date";
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
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const [draftId, setDraftId] = useState<string | null>(persistedParams.draftId ?? null);
  const initialClientType: (typeof CLIENT_TYPES)[number] =
    persistedParams.clientType === "individual" ? "individual" : "business";
  const [client, setClient] = useState(persistedParams.client ?? "");
  const [clientType, setClientType] = useState<(typeof CLIENT_TYPES)[number]>(initialClientType);
  const [businessName, setBusinessName] = useState(persistedParams.businessName ?? "");
  const [amount, setAmount] = useState(persistedParams.amount ?? "");
  const [dueDate, setDueDate] = useState(persistedParams.dueDate ?? "");
  const [notes, setNotes] = useState(persistedParams.notes ?? "");
  const [iosDatePickerVisible, setIosDatePickerVisible] = useState(false);
  const [iosDateValue, setIosDateValue] = useState(() =>
    persistedParams.dueDate ? parseISOToDate(persistedParams.dueDate) : new Date(),
  );
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
  const [savedClientSearch, setSavedClientSearch] = useState("");

  const hasDraftDetails =
    Boolean(client.trim()) || Boolean(businessName.trim()) || Boolean(amount.trim()) || Boolean(dueDate) || Boolean(notes.trim());

  const draftParams = useMemo(() => {
    if (!hasDraftDetails) {
      return {};
    }
    const payload: Record<string, string> = {};
    payload.clientType = clientType;
    payload.client = client.trim();
    if (clientType === "business" && businessName.trim()) {
      payload.businessName = businessName.trim();
    }
    if (amount.trim()) {
      payload.amount = amount.trim();
    }
    if (dueDate) {
      payload.dueDate = dueDate;
    }
    if (notes.trim()) {
      payload.notes = notes.trim();
    }
    return payload;
  }, [amount, businessName, client, clientType, dueDate, hasDraftDetails, notes]);

  const draftMetadata = useMemo(() => {
    if (!hasDraftDetails) {
      return null;
    }
    return {
      client_name: client.trim() || "New reminder",
      amount_display: amount.trim() || null,
      status: "Draft details",
      next_action: "Add delivery settings to continue.",
    };
  }, [amount, client, hasDraftDetails]);

  const { ensureDraftSaved } = useReminderDraftPersistor({
    token: session?.accessToken ?? null,
    draftId,
    onDraftId: setDraftId,
    params: draftParams,
    metadata: draftMetadata ?? undefined,
    lastStep: "details",
    lastPath: "/(tabs)/new-reminder",
    enabled: Boolean(session?.accessToken) && hasDraftDetails,
  });

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
      const savedDraftId = await ensureDraftSaved();
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
          ...(savedDraftId ? { draftId: savedDraftId } : {}),
        },
      });
    },
    [amount, dueDate, ensureDraftSaved, notes, router],
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

  const filteredSavedClients = useMemo(() => {
    if (!savedClientSearch.trim()) return savedClients;
    const query = savedClientSearch.trim().toLowerCase();
    return savedClients.filter((entry) => {
      const baseFields = [entry.name, entry.company_name ?? ""];
      const contactFields = entry.contact_methods?.map((method) => {
        const summary = getContactSummary(method);
        return `${method.label ?? ""} ${summary}`;
      });
      const allFields = [...baseFields, ...(contactFields ?? [])];
      return allFields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [savedClientSearch, savedClients]);

  const savedClientsHint = savedClientSearch.trim()
    ? filteredSavedClients.length
      ? `Showing ${filteredSavedClients.length} ${filteredSavedClients.length === 1 ? "match" : "matches"}.`
      : `No clients match “${savedClientSearch.trim()}”.`
    : "Tap any card to reuse its contact details.";

  const reopenQuickModalIfNeeded = () => {
    if (reopenQuickModalAfterPicker) {
      setQuickPickModalVisible(true);
      setReopenQuickModalAfterPicker(false);
    }
  };

  const handleReturnToReminders = () => {
    router.replace("/reminders");
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
        {draftId ? (
          <View style={styles.draftNavRow}>
            <Pressable style={styles.draftNavButton} onPress={handleReturnToReminders}>
              <Feather name="arrow-left" size={18} color={Theme.palette.slate} />
              <Text style={styles.draftNavText}>Back to reminders</Text>
            </Pressable>
          </View>
        ) : null}
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
            const savedDraftId = await ensureDraftSaved();
            router.push({
              pathname: "/new-reminder/contact-platform",
              params: {
                client: client.trim(),
                clientType,
                businessName: clientType === "business" ? businessName.trim() : "",
                amount: amount.trim(),
                notes: notes.trim(),
                ...(dueDate ? { dueDate } : {}),
                ...(savedDraftId ? { draftId: savedDraftId } : {}),
              },
            });
          }}
        >
          <Feather name="plus-circle" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Schedule reminder</Text>
        </Pressable>
        {scheduleError ? <Text style={styles.errorText}>{scheduleError}</Text> : null}

        <SavedClientsSection
          clients={filteredSavedClients}
          loading={clientsLoading}
          error={clientsError}
          onSelect={handleUseSavedClient}
          limit={savedClientSearch.trim() ? undefined : 4}
          hint={savedClientsHint}
          showWhenEmpty={Boolean(savedClientSearch.trim())}
          emptyText={`No clients match “${savedClientSearch.trim()}”.`}
          showSearch={savedClients.length > 4}
          searchValue={savedClientSearch}
          onChangeSearch={setSavedClientSearch}
          searchPlaceholder="Search saved clients"
        />
      </ScrollView>
      <MissingDetailsModal
        visible={quickPickModalVisible}
        missingFields={missingQuickPickFields}
        dueDateLabel={dueDate ? formatDueDateLabel(dueDate) : "Add a due date"}
        hasDueDate={Boolean(dueDate)}
        onPressDueDate={() => openDueDatePicker({ reopenQuick: true })}
        notesValue={notes}
        onChangeNotes={setNotes}
        onSkip={async () => {
          setReopenQuickModalAfterPicker(false);
          if (quickPickPending) {
            const platform = resolvePlatformFromMethod(quickPickPending.method.type);
            if (!platform) {
              Alert.alert("Unsupported contact", "This contact type cannot be used yet.");
              return;
            }
            await proceedToSendOptions(quickPickPending.client, quickPickPending.method, platform);
          }
          setQuickPickModalVisible(false);
          setQuickPickPending(null);
        }}
        onSave={async () => {
          setReopenQuickModalAfterPicker(false);
          if (quickPickPending) {
            const platform = resolvePlatformFromMethod(quickPickPending.method.type);
            if (!platform) {
              Alert.alert("Unsupported contact", "This contact type cannot be used yet.");
              return;
            }
            await proceedToSendOptions(quickPickPending.client, quickPickPending.method, platform);
          }
          setQuickPickModalVisible(false);
          setQuickPickPending(null);
        }}
      />
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

function normalizeParams(params: Record<string, string | string[]>) {
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value[0] ?? "";
    } else if (typeof value === "string") {
      result[key] = value;
    }
  });
  return result;
}

const styles = StyleSheet.create({
  draftNavRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  draftNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingBottom: Theme.spacing.sm,
  },
  draftNavText: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
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
});
