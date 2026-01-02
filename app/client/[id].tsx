import { Feather } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BankBadge from "@/assets/iban.png";
import ReminderSchedulePicker, { ReminderScheduleSelection } from "@/components/reminder-schedule-picker";
import { Theme } from "@/constants/theme";
import {
  clientProfiles,
  ClientType,
  PaymentMethod,
  ReminderSchedule,
} from "@/data/mock-clients";
import { paymentLogos } from "@/data/payment-methods";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { schedulePayloadToSummary } from "@/lib/reminder-schedule";
import { useAuth } from "@/providers/auth-provider";
import { fetchClient } from "@/services/clients";
import {
  fetchInvoices,
  markInvoicePaid,
  markInvoiceUnpaid,
  pauseInvoice,
  rescheduleInvoice as rescheduleInvoiceRequest,
  resumeInvoice,
} from "@/services/invoices";
import { fetchTimezones, TimezoneInfo } from "@/services/timezones";
import type { Client, ContactMethod } from "@/types/clients";
import type { Invoice, ReminderScheduleMode, ReminderSchedulePayload } from "@/types/invoices";
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
type InvoiceActionMode = "markPaid" | "markUnpaid" | "pause" | "resume";

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    invoice: Invoice;
    mode: InvoiceActionMode;
  } | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Invoice | null>(null);
  const [rescheduleSelection, setRescheduleSelection] = useState<ReminderScheduleSelection | null>(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const fallbackTimezone =
    user?.default_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const [rescheduleTimezone, setRescheduleTimezone] = useState<string | null>(null);
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneInfo[]>([]);
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [timezoneListLoading, setTimezoneListLoading] = useState(false);
  const handleRescheduleTimezoneSelect = useCallback((zone: string) => {
    setRescheduleTimezone(zone);
    setTimezonePickerVisible(false);
  }, []);
  useEffect(() => {
    if (!timezonePickerVisible || timezoneOptions.length) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setTimezoneListLoading(true);
      try {
        const list = await fetchTimezones();
        if (!cancelled) {
          setTimezoneOptions(list);
        }
      } catch {
        if (!cancelled) {
          setTimezoneOptions([]);
        }
      } finally {
        if (!cancelled) {
          setTimezoneListLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [timezonePickerVisible, timezoneOptions.length]);
  const filteredRescheduleTimezones = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase();
    if (!query) return timezoneOptions;
    return timezoneOptions.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query)
    );
  }, [timezoneOptions, timezoneSearch]);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);

  const reminders = useMemo(() => {
    if (id && clientProfiles[id]?.reminders?.length) {
      return clientProfiles[id].reminders;
    }
    const firstProfile = Object.values(clientProfiles)[0];
    return firstProfile ? firstProfile.reminders : [];
  }, [id]);
  const rescheduleDefaults = useMemo(() => {
    if (!rescheduleTarget?.reminder_schedule) {
      return null;
    }
    try {
      return schedulePayloadToSummary(rescheduleTarget.reminder_schedule as ReminderSchedulePayload);
    } catch {
      return null;
    }
  }, [rescheduleTarget]);

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

  const loadClient = useCallback(async () => {
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
  }, [id, session?.accessToken]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient]),
  );

  const requestInvoiceAction = (invoice: Invoice, mode?: InvoiceActionMode) => {
    const resolvedMode =
      mode ?? (invoice.status === "paid" ? "markUnpaid" : "markPaid");
    setActionError(null);
    setConfirmAction({ invoice, mode: resolvedMode });
  };

  const handleInvoiceAction = async () => {
    if (!confirmAction || !session?.accessToken) return;
    setActionProcessing(true);
    setActionError(null);
    try {
      let updatedInvoice: Invoice;
      switch (confirmAction.mode) {
        case "markPaid":
          updatedInvoice = await markInvoicePaid(
            confirmAction.invoice.id,
            session.accessToken
          );
          break;
        case "markUnpaid":
          updatedInvoice = await markInvoiceUnpaid(
            confirmAction.invoice.id,
            session.accessToken
          );
          break;
        case "pause":
          updatedInvoice = await pauseInvoice(
            confirmAction.invoice.id,
            session.accessToken
          );
          break;
        case "resume":
          updatedInvoice = await resumeInvoice(
            confirmAction.invoice.id,
            session.accessToken
          );
          break;
        default:
          updatedInvoice = confirmAction.invoice;
      }
      setInvoices((prev) => {
        const next = prev.map((item) =>
          item.id === updatedInvoice.id ? updatedInvoice : item
        );
        if (id) {
          setCachedValue(CLIENT_INVOICES_CACHE_KEY(id), next);
        }
        return next;
      });
      setConfirmAction(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to update this invoice. Try again."
      );
    } finally {
      setActionProcessing(false);
    }
  };

  const openRescheduleModal = (invoice: Invoice) => {
    setRescheduleTarget(invoice);
    setRescheduleSelection(null);
    setRescheduleError(null);
    setRescheduleSaving(false);
    const inheritedTimezone =
      invoice.timezone ??
      client?.timezone ??
      fallbackTimezone;
    setRescheduleTimezone(inheritedTimezone);
  };

  const closeRescheduleModal = () => {
    setRescheduleTarget(null);
    setRescheduleSelection(null);
    setRescheduleError(null);
    setRescheduleSaving(false);
    setTimezonePickerVisible(false);
    setTimezoneSearch("");
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !session?.accessToken) {
      setRescheduleError("Sign in again to reschedule this invoice.");
      return;
    }
    if (!rescheduleSelection?.schedulePayload || !rescheduleSelection.canSubmit) {
      setRescheduleError("Select at least one reminder before saving.");
      return;
    }
    const timezoneValue = rescheduleTimezone ?? reminderTimezone;
    setRescheduleSaving(true);
    setRescheduleError(null);
    try {
      const updatedInvoice = await rescheduleInvoiceRequest(
        rescheduleTarget.id,
        rescheduleSelection.schedulePayload,
        session.accessToken,
        timezoneValue,
      );
      setInvoices((prev) => {
        const next = prev.map((item) => (item.id === updatedInvoice.id ? updatedInvoice : item));
        if (id) {
          setCachedValue(CLIENT_INVOICES_CACHE_KEY(id), next);
        }
        return next;
      });
      closeRescheduleModal();
    } catch (err) {
      setRescheduleError(
        err instanceof Error ? err.message : "Unable to reschedule this invoice right now.",
      );
    } finally {
      setRescheduleSaving(false);
    }
  };

  const showActionInfo = (title: string, message: string) => {
    setInfoModal({ title, message });
  };

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

  const clientFriendlyName =
    client.name && client.name.trim().length > 0
      ? client.name
      : "your client";
  const reminderTimezone = client.timezone ?? fallbackTimezone;
  const confirmCopy = confirmAction
    ? buildConfirmCopy(confirmAction.mode, clientFriendlyName)
    : null;

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
          <View style={styles.clientTimezoneRow}>
            <View style={styles.clientTimezoneText}>
              <Text style={styles.infoLabel}>Reminder timezone</Text>
              <Text style={styles.infoValue}>{reminderTimezone}</Text>
            </View>
            {id ? (
              <Pressable
                style={styles.clientTimezoneButton}
                onPress={() =>
                  router.push({
                    pathname: "/client/[id]/timezone",
                    params: { id },
                  })
                }
              >
                <Feather name="edit-3" size={14} color="#FFFFFF" />
                <Text style={styles.clientTimezoneButtonLabel}>Change</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          {invoices.length === 0 ? (
            <Text style={styles.emptyDetail}>
              No reminders on record for this client.
            </Text>
          ) : (
            invoices.map((invoice) => {
              const isPaid = invoice.status === "paid";
              const isPaused = invoice.status === "paused";
              const canPauseResume = invoice.status !== "paid" && invoice.status !== "overdue";
              const canReschedule = invoice.status === "overdue";
              const confirmInfoCopy = isPaid
                ? "Switch this back to collecting and restart reminders."
                : `DueSoon emails ${clientFriendlyName} right after you confirm payment.`;
              const pauseInfoCopy = isPaused
                ? "Resume this schedule when the client is ready to continue."
                : "Pause this invoice to temporarily stop reminders without marking it paid.";
              const rescheduleInfoCopy =
                "Overdue means there are no reminders left. Reschedule to queue a fresh follow-up plan.";
              return (
                <View key={invoice.id} style={styles.reminderBlock}>
                  <View style={styles.reminderHeader}>
                    <Text style={styles.reminderAmount}>
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </Text>
                    <Text style={styles.reminderStatus}>
                      {invoice.status}
                    </Text>
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
                  <InfoRow
                    label="Reminder timezone"
                    value={invoice.timezone ?? reminderTimezone}
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
                  <View style={styles.invoiceActions}>
                    <Pressable
                      style={[
                        styles.invoiceActionButton,
                        isPaid
                          ? styles.invoiceActionButtonSecondary
                          : styles.invoiceActionButtonPrimary,
                      ]}
                      onPress={() => requestInvoiceAction(invoice)}
                    >
                      <View style={styles.invoiceActionButtonContent}>
                        <Feather
                          name={isPaid ? "rotate-ccw" : "check-circle"}
                          size={16}
                          color={isPaid ? Theme.palette.ink : "#FFFFFF"}
                        />
                        <Text
                          style={[
                            styles.invoiceActionLabel,
                            isPaid
                              ? styles.invoiceActionLabelSecondary
                              : styles.invoiceActionLabelPrimary,
                          ]}
                        >
                          {isPaid ? "Mark as unpaid" : "Confirm payment"}
                        </Text>
                        <Pressable
                          style={styles.invoiceInfoButton}
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            showActionInfo(isPaid ? "Mark as unpaid" : "Confirm payment", confirmInfoCopy);
                          }}
                        >
                          <Feather
                            name="info"
                            size={13}
                            color={isPaid ? Theme.palette.ink : "#FFFFFF"}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                    {canPauseResume ? (
                      <Pressable
                        style={[
                          styles.invoiceActionButton,
                          isPaused
                            ? styles.invoiceActionButtonPrimary
                            : styles.invoiceActionButtonSecondary,
                        ]}
                        onPress={() =>
                          requestInvoiceAction(
                            invoice,
                            isPaused ? "resume" : "pause"
                          )
                        }
                      >
                        <View style={styles.invoiceActionButtonContent}>
                          <Feather
                            name={isPaused ? "play-circle" : "pause-circle"}
                            size={16}
                            color={isPaused ? "#FFFFFF" : Theme.palette.ink}
                          />
                          <Text
                            style={[
                              styles.invoiceActionLabel,
                              isPaused
                                ? styles.invoiceActionLabelPrimary
                                : styles.invoiceActionLabelSecondary,
                            ]}
                          >
                            {isPaused ? "Resume reminders" : "Pause invoice"}
                          </Text>
                          <Pressable
                            style={styles.invoiceInfoButton}
                            hitSlop={8}
                            onPress={(event) => {
                              event.stopPropagation();
                              showActionInfo(
                                isPaused ? "Resume reminders" : "Pause invoice",
                                pauseInfoCopy
                              );
                            }}
                          >
                            <Feather
                              name="info"
                              size={13}
                              color={isPaused ? "#FFFFFF" : Theme.palette.ink}
                            />
                          </Pressable>
                        </View>
                      </Pressable>
                    ) : null}
                    {canReschedule ? (
                      <Pressable
                        style={[
                          styles.invoiceActionButton,
                          styles.invoiceActionButtonSecondary,
                        ]}
                        onPress={() => openRescheduleModal(invoice)}
                      >
                        <View style={styles.invoiceActionButtonContent}>
                          <Feather
                            name="refresh-ccw"
                            size={16}
                            color={Theme.palette.ink}
                          />
                          <Text
                            style={[
                              styles.invoiceActionLabel,
                              styles.invoiceActionLabelSecondary,
                            ]}
                          >
                            Reschedule
                          </Text>
                          <Pressable
                            style={styles.invoiceInfoButton}
                            hitSlop={8}
                            onPress={(event) => {
                              event.stopPropagation();
                              showActionInfo("Reschedule", rescheduleInfoCopy);
                            }}
                          >
                            <Feather
                              name="info"
                              size={13}
                              color={Theme.palette.ink}
                            />
                          </Pressable>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(confirmAction)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmAction(null);
          setActionError(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {confirmCopy?.title ?? "Confirm"}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmCopy?.message ?? ""}
            </Text>
            {actionError ? (
              <Text style={styles.actionErrorText}>{actionError}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonMuted]}
                onPress={() => {
                  setConfirmAction(null);
                  setActionError(null);
                }}
                disabled={actionProcessing}
              >
                <Text style={styles.confirmButtonMutedLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmButton,
                  styles.confirmButtonPrimary,
                  actionProcessing && styles.confirmButtonDisabled,
                ]}
                onPress={handleInvoiceAction}
                disabled={actionProcessing}
              >
                {actionProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonPrimaryLabel}>
                    {confirmCopy?.confirmLabel ?? "Confirm"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(rescheduleTarget)}
        animationType="slide"
        onRequestClose={closeRescheduleModal}
      >
        <SafeAreaView style={styles.rescheduleModal}>
          <ScrollView contentContainerStyle={styles.rescheduleContent}>
            <View style={styles.rescheduleHeader}>
              <Text style={styles.rescheduleTitle}>Reschedule reminders</Text>
              <Text style={styles.rescheduleSubtitle}>
                {rescheduleTarget
                  ? `Use the schedule picker to restart follow-ups for ${
                      clientFriendlyName || "this client"
                    }.`
                  : null}
              </Text>
            </View>
            <View style={styles.rescheduleTimezoneCard}>
              <View>
                <Text style={styles.infoLabel}>Reminder timezone</Text>
                <Text style={styles.infoValue}>{rescheduleTimezone ?? reminderTimezone}</Text>
              </View>
              <Pressable
                style={styles.rescheduleTimezoneButton}
                onPress={() => setTimezonePickerVisible(true)}
              >
                <Feather name="map-pin" size={14} color="#FFFFFF" />
                <Text style={styles.rescheduleTimezoneButtonLabel}>Change</Text>
              </Pressable>
            </View>
            <ReminderSchedulePicker
              key={rescheduleTarget?.id ?? "reschedule-picker"}
              initialMode={
                rescheduleDefaults?.mode ??
                ((rescheduleTarget?.reminder_schedule?.mode as ReminderScheduleMode | undefined) ?? "manual")
              }
              initialSummary={rescheduleDefaults?.summary ?? null}
              onChange={setRescheduleSelection}
            />
            {rescheduleError ? (
              <Text style={styles.actionErrorText}>{rescheduleError}</Text>
            ) : null}
            <View style={styles.rescheduleActions}>
              <Pressable
                style={[styles.rescheduleButton, styles.rescheduleCancelButton]}
                onPress={closeRescheduleModal}
                disabled={rescheduleSaving}
              >
                <Text style={styles.rescheduleCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.rescheduleButton,
                  styles.rescheduleSaveButton,
                  (!rescheduleSelection?.canSubmit || rescheduleSaving) &&
                    styles.rescheduleButtonDisabled,
                ]}
                onPress={handleRescheduleSubmit}
                disabled={!rescheduleSelection?.canSubmit || rescheduleSaving}
              >
                {rescheduleSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rescheduleSaveLabel}>Save schedule</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={timezonePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <View style={styles.tzModalOverlay}>
          <View style={styles.tzModalCard}>
            <Text style={styles.tzModalTitle}>Select a timezone</Text>
            <View style={styles.tzModalSearch}>
              <Feather name="search" size={16} color={Theme.palette.slate} />
              <TextInput
                style={styles.tzModalInput}
                placeholder="Search by region or offset"
                placeholderTextColor={Theme.palette.slateSoft}
                value={timezoneSearch}
                onChangeText={setTimezoneSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {timezoneListLoading ? (
              <View style={styles.tzLoadingState}>
                <ActivityIndicator color={Theme.palette.ink} />
              </View>
            ) : (
              <ScrollView style={styles.tzList}>
                {filteredRescheduleTimezones.map((entry) => {
                  const active = entry.name === (rescheduleTimezone ?? reminderTimezone);
                  return (
                    <Pressable
                      key={entry.name}
                      style={[styles.tzRow, active && styles.tzRowActive]}
                      onPress={() => handleRescheduleTimezoneSelect(entry.name)}
                    >
                      <View>
                        <Text style={styles.tzRowLabel}>{entry.label}</Text>
                        <Text style={styles.tzRowSubtle}>{entry.name}</Text>
                      </View>
                      {active ? (
                        <Feather name="check" size={18} color={Theme.palette.slate} />
                      ) : (
                        <Feather name="circle" size={16} color={Theme.palette.slateSoft} />
                      )}
                    </Pressable>
                  );
                })}
                {!filteredRescheduleTimezones.length && !timezoneListLoading ? (
                  <Text style={styles.tzEmptyText}>No timezones match your search.</Text>
                ) : null}
              </ScrollView>
            )}
            <Pressable style={styles.tzDismissButton} onPress={() => setTimezonePickerVisible(false)}>
              <Text style={styles.tzDismissLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(infoModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{infoModal?.title}</Text>
            <Text style={styles.infoMessage}>{infoModal?.message}</Text>
            <Pressable
              style={[styles.infoDismissButton, styles.confirmButtonPrimary]}
              onPress={() => setInfoModal(null)}
            >
              <Text style={styles.infoDismissLabel}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

function buildConfirmCopy(mode: InvoiceActionMode, clientName: string) {
  switch (mode) {
    case "markPaid":
      return {
        title: "Confirm payment",
        message: `DueSoon will mark this invoice as paid, pause reminders, and notify ${clientName} that you've confirmed their payment.`,
        confirmLabel: "Confirm payment",
      };
    case "markUnpaid":
      return {
        title: "Mark as unpaid",
        message:
          "We’ll clear the paid timestamp, move this invoice back to collecting, and resume reminders based on its schedule.",
        confirmLabel: "Mark unpaid",
      };
    case "pause":
      return {
        title: "Pause invoice",
        message:
          "DueSoon will pause this invoice and keep all reminders on hold until you resume it.",
        confirmLabel: "Pause invoice",
      };
    case "resume":
      return {
        title: "Resume reminders",
        message:
          "We’ll switch the invoice back to active, re-enable reminders, and place it back in the sending queue.",
        confirmLabel: "Resume invoice",
      };
    default:
      return {
        title: "Confirm",
        message: "",
        confirmLabel: "Confirm",
      };
  }
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
    case "neutral":
      return {
        backgroundColor: "rgba(133, 160, 189, 0.2)",
        color: Theme.palette.slate,
        label: "Neutral",
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
  clientTimezoneRow: {
    marginTop: Theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
  },
  clientTimezoneText: {
    flex: 1,
  },
  clientTimezoneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  clientTimezoneButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
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
  invoiceActions: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.palette.border,
    paddingTop: Theme.spacing.sm,
  },
  invoiceActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radii.md,
  },
  invoiceActionButtonPrimary: {
    backgroundColor: Theme.palette.ink,
  },
  invoiceActionButtonSecondary: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
  },
  invoiceActionLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  invoiceActionLabelPrimary: {
    color: "#FFFFFF",
  },
  invoiceActionLabelSecondary: {
    color: Theme.palette.ink,
  },
  invoiceActionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    flex: 1,
  },
  invoiceInfoButton: {
    marginLeft: "auto",
    padding: Theme.spacing.xs,
    borderRadius: Theme.radii.full,
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(28, 31, 35, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  confirmCard: {
    width: "100%",
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  confirmMessage: {
    fontSize: 15,
    color: Theme.palette.slate,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonMuted: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
  },
  confirmButtonPrimary: {
    backgroundColor: Theme.palette.ink,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonMutedLabel: {
    color: Theme.palette.ink,
    fontSize: 15,
    fontWeight: "500",
  },
  confirmButtonPrimaryLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  rescheduleModal: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  rescheduleContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  rescheduleHeader: {
    gap: Theme.spacing.xs,
  },
  rescheduleTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  rescheduleSubtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  rescheduleActions: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
  },
  rescheduleTimezoneCard: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
  },
  rescheduleTimezoneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  rescheduleTimezoneButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  rescheduleButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    alignItems: "center",
  },
  rescheduleCancelButton: {
    backgroundColor: Theme.palette.surface,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  rescheduleSaveButton: {
    backgroundColor: Theme.palette.slate,
  },
  rescheduleButtonDisabled: {
    opacity: 0.4,
  },
  rescheduleCancelLabel: {
    color: Theme.palette.ink,
    fontWeight: "600",
    fontSize: 15,
  },
  rescheduleSaveLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(28, 31, 35, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  infoCard: {
    width: "100%",
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  infoMessage: {
    fontSize: 15,
    color: Theme.palette.slate,
    lineHeight: 22,
  },
  infoDismissButton: {
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    alignItems: "center",
  },
  infoDismissLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  actionErrorText: {
    color: Theme.palette.accent,
    fontSize: 13,
  },
  tzModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  tzModalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: Theme.radii.xl,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  tzModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  tzModalSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  tzModalInput: {
    flex: 1,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  tzLoadingState: {
    paddingVertical: Theme.spacing.lg,
    alignItems: "center",
  },
  tzList: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    maxHeight: 360,
  },
  tzRow: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tzRowActive: {
    backgroundColor: Theme.palette.surface,
  },
  tzRowLabel: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  tzRowSubtle: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  tzEmptyText: {
    padding: Theme.spacing.md,
    textAlign: "center",
    color: Theme.palette.slate,
  },
  tzDismissButton: {
    alignSelf: "flex-end",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  tzDismissLabel: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
});
