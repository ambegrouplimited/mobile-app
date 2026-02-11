import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
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
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";
import { useTelegramMtprotoFlow } from "@/hooks/useTelegramMtprotoFlow";
import { useAuth } from "@/providers/auth-provider";
import { createClient } from "@/services/clients";
import {
  connectGmailAccount,
  fetchGmailStatus,
  GmailStatus,
} from "@/services/gmail";
import {
  connectOutlookAccount,
  fetchOutlookStatus,
  OutlookStatus,
} from "@/services/outlook";
import {
  connectSlackAccount,
  fetchSlackStatus,
  fetchSlackUsers,
  SlackStatus,
  SlackUser,
} from "@/services/slack";
import {
  fetchTelegramContacts,
  fetchTelegramStatus,
  TelegramContact,
  TelegramStatus,
} from "@/services/telegram";
import type {
  ClientCreatePayload,
  ContactMethod,
  ContactMethodPayload,
} from "@/types/clients";

WebBrowser.maybeCompleteAuthSession();

const platformMeta = {
  gmail: {
    label: "Gmail",
    contactLabel: "Client email",
    placeholder: "client@example.com",
    keyboard: "email-address",
  },
  outlook: {
    label: "Outlook",
    contactLabel: "Client email",
    placeholder: "client@example.com",
    keyboard: "email-address",
  },
  slack: {
    label: "Slack",
    contactLabel: "Slack contact",
    placeholder: "@client",
  },
  whatsapp: {
    label: "WhatsApp Business",
    contactLabel: "WhatsApp Business number",
    placeholder: "+1 (415) 555-2981",
    keyboard: "phone-pad",
  },
  telegram: {
    label: "Telegram Business",
    contactLabel: "Telegram Business handle",
    placeholder: "@client",
  },
} as const;

const proxySupported = new Set<PlatformId>(["gmail", "outlook"]);

type PlatformId = keyof typeof platformMeta;
type DispatchMode = "self" | "proxy";
type ConnectionState = {
  connected: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  meta?: string | null;
};

type ContactFieldState = {
  label: string;
  email: string;
  phone: string;
  slackTeamId: string;
  slackUserId: string;
  telegramChatId: string;
  telegramUsername: string;
};

type ValidationResult =
  | { valid: false; error: string }
  | { valid: true; contactPayload: ContactMethodPayload; summary: string };

const ENV_OAUTH_REDIRECT = process.env.EXPO_PUBLIC_GMAIL_REDIRECT_URL;

export default function SendOptionsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(
    () => normalizeParams(rawParams),
    [rawParams],
  );
  const [platform, setPlatform] = useState<PlatformId>(() => {
    return platformMeta[persistedParams.platform as PlatformId]
      ? (persistedParams.platform as PlatformId)
      : "gmail";
  });

  const [selection, setSelection] = useState<DispatchMode>(
    (persistedParams.mode as DispatchMode) ??
      (proxySupported.has(platform) ? "proxy" : "self"),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const clientName = (persistedParams.client ?? "").trim();
  const [contactLabel, setContactLabel] = useState(
    persistedParams.contactLabel ||
      buildContactLabelDefault(platform, clientName),
  );
  const [contactEmail, setContactEmail] = useState(
    persistedParams.contact ?? "",
  );
  const [contactPhone, setContactPhone] = useState(
    persistedParams.contactPhone ?? "",
  );
  const [slackTeamId, setSlackTeamId] = useState(
    persistedParams.slackTeamId ?? "",
  );
  const [slackUserId, setSlackUserId] = useState(
    persistedParams.slackUserId ?? "",
  );
  const [telegramChatId, setTelegramChatId] = useState(
    persistedParams.telegramChatId ?? "",
  );
  const [telegramUsername, setTelegramUsername] = useState(
    persistedParams.telegramUsername ?? "",
  );
  const [slackStatusData, setSlackStatusData] = useState<SlackStatus | null>(
    null,
  );
  const [slackUsersByWorkspace, setSlackUsersByWorkspace] = useState<
    Record<string, SlackUser[]>
  >({});
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [slackUsersLoading, setSlackUsersLoading] = useState(false);
  const [slackUsersError, setSlackUsersError] = useState<string | null>(null);
  const [slackWorkspaceExpanded, setSlackWorkspaceExpanded] = useState(false);
  const [slackUsersExpanded, setSlackUsersExpanded] = useState(false);
  const [telegramContacts, setTelegramContacts] = useState<TelegramContact[]>(
    [],
  );
  const [telegramContactsLoading, setTelegramContactsLoading] = useState(false);
  const [telegramContactsError, setTelegramContactsError] = useState<
    string | null
  >(null);
  const [telegramContactsRefreshToken, setTelegramContactsRefreshToken] =
    useState(0);
  const [telegramPickerExpanded, setTelegramPickerExpanded] = useState(false);
  const [telegramSearch, setTelegramSearch] = useState("");
  const [slackSearch, setSlackSearch] = useState("");
  const triggerTelegramContactsRefresh = useCallback(() => {
    setTelegramContactsRefreshToken((prev) => prev + 1);
  }, []);
  const slackWorkspaces = useMemo(
    () => slackStatusData?.workspaces ?? [],
    [slackStatusData],
  );
  const selectedSlackWorkspace = useMemo(() => {
    if (!slackTeamId) return null;
    return (
      slackWorkspaces.find((workspace) => workspace.team_id === slackTeamId) ??
      null
    );
  }, [slackTeamId, slackWorkspaces]);
  const filteredSlackUsers = useMemo(() => {
    const source = slackUsersByWorkspace[slackTeamId] ?? slackUsers;
    if (!slackSearch.trim()) return source;
    const term = slackSearch.trim().toLowerCase();
    return source.filter((member) => {
      const haystack = `${member.real_name ?? ""} ${member.display_name ?? ""} ${member.name ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [slackSearch, slackTeamId, slackUsers, slackUsersByWorkspace]);
  const selectedSlackUser = useMemo(() => {
    if (!slackUserId) return null;
    return filteredSlackUsers.find((user) => user.id === slackUserId) ?? null;
  }, [slackUserId, filteredSlackUsers]);
  const filteredTelegramContacts = useMemo(() => {
    if (!telegramSearch.trim()) return telegramContacts;
    const term = telegramSearch.trim().toLowerCase();
    return telegramContacts.filter((contact) => {
      const haystack = `${contact.name ?? ""} ${contact.username ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [telegramContacts, telegramSearch]);
  const selectedTelegramContact = useMemo(() => {
    if (!telegramChatId) return null;
    return (
      telegramContacts.find(
        (contact) => String(contact.chat_id) === telegramChatId,
      ) ?? null
    );
  }, [telegramChatId, telegramContacts]);
  const [contactError, setContactError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [selectionRequiresConnection, setSelectionRequiresConnection] =
    useState(selection === "self" && supportsConnection(platform));
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    () => ({
      connected: !selectionRequiresConnection,
      loading: selectionRequiresConnection,
      busy: false,
      error: null,
      meta: null,
    }),
  );
  const [telegramFlowActive, setTelegramFlowActive] = useState(false);
  const [telegramStatusSnapshot, setTelegramStatusSnapshot] =
    useState<TelegramStatus | null>(null);
  const draftId = persistedParams.draftId ?? null;
  const baseParams = useMemo(() => {
    const next = { ...persistedParams };
    delete next.draftId;
    return next;
  }, [persistedParams]);
  const hasContactDetails = useMemo(() => {
    if (platform === "gmail" || platform === "outlook") {
      return Boolean(contactEmail.trim());
    }
    if (platform === "whatsapp") {
      return Boolean(contactPhone.trim());
    }
    if (platform === "slack") {
      return Boolean(slackTeamId && slackUserId);
    }
    if (platform === "telegram") {
      return Boolean(telegramChatId);
    }
    return Boolean(contactEmail.trim());
  }, [
    contactEmail,
    contactPhone,
    platform,
    slackTeamId,
    slackUserId,
    telegramChatId,
  ]);
  const paramsForDraft = useMemo(() => {
    const next: Record<string, string> = { ...baseParams };
    next.platform = platform;
    next.mode = selection;
    if (contactLabel.trim()) {
      next.contactLabel = contactLabel.trim();
    }
    if (contactEmail.trim()) {
      next.contact = contactEmail.trim();
    }
    if (contactPhone.trim()) {
      next.contactPhone = contactPhone.trim();
    }
    if (slackTeamId) {
      next.slackTeamId = slackTeamId;
    }
    if (slackUserId) {
      next.slackUserId = slackUserId;
    }
    if (telegramChatId) {
      next.telegramChatId = telegramChatId;
    }
    if (telegramUsername) {
      next.telegramUsername = telegramUsername;
    }
    return next;
  }, [
    baseParams,
    contactEmail,
    contactLabel,
    contactPhone,
    platform,
    selection,
    slackTeamId,
    slackUserId,
    telegramChatId,
    telegramUsername,
  ]);
  const metadata = useMemo(
    () => ({
      client_name: baseParams.client || "New reminder",
      amount_display: formatAmountDisplay(
        baseParams.amount,
        baseParams.currency,
      ),
      status: hasContactDetails ? "Contact saved" : "Add contact details",
      next_action: hasContactDetails
        ? "Attach a payment method."
        : "Fill in the contact details.",
    }),
    [
      baseParams.amount,
      baseParams.currency,
      baseParams.client,
      hasContactDetails,
    ],
  );
  const handleReturnToReminders = () => {
    router.replace("/reminders");
  };
  const handleBack = () => {
    if (draftId) {
      router.push({
        pathname: "/new-reminder/contact-platform",
        params: {
          ...baseParams,
          ...(draftId ? { draftId } : {}),
        },
      });
      return;
    }
    router.back();
  };
  const { ensureDraftSaved } = useReminderDraftPersistor({
    token: session?.accessToken ?? null,
    draftId,
    params: paramsForDraft,
    metadata,
    lastStep: "send-options",
    lastPath: "/new-reminder/send-options",
    enabled: Boolean(session?.accessToken && draftId),
  });

  const loadConnectionStatus = useCallback(async () => {
    if (!selectionRequiresConnection || !session?.accessToken) {
      return;
    }
    setConnectionState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (platform !== "telegram") {
        setTelegramStatusSnapshot(null);
      }
      if (platform === "gmail") {
        const status = await fetchGmailStatus(session.accessToken);
        setConnectionState((prev) => ({
          ...prev,
          connected: status.connected,
          loading: false,
          meta: formatGmailMeta(status),
          error: null,
        }));
        return;
      }
      if (platform === "outlook") {
        const status = await fetchOutlookStatus(session.accessToken);
        setConnectionState((prev) => ({
          ...prev,
          connected: status.connected,
          loading: false,
          meta: formatOutlookMeta(status),
          error: null,
        }));
        return;
      }
      if (platform === "slack") {
        const status = await fetchSlackStatus(session.accessToken);
        const workspaces = status.workspaces ?? [];
        const connected = workspaces.length > 0;
        setSlackStatusData(status);
        if (!connected) {
          setSlackTeamId("");
          setSlackUserId("");
          setSlackUsers([]);
          setSlackUsersByWorkspace({});
        } else {
          setSlackTeamId((prev) => {
            if (
              prev &&
              workspaces.some((workspace) => workspace.team_id === prev)
            ) {
              return prev;
            }
            return workspaces[0]?.team_id ?? "";
          });
        }
        setConnectionState((prev) => ({
          ...prev,
          connected,
          loading: false,
          meta: connected ? formatSlackMeta(status) : null,
          error: null,
        }));
        return;
      }
      if (platform === "telegram") {
        const status = await fetchTelegramStatus(session.accessToken);
        const connected = Boolean(
          status.has_business_connection && status.connection?.connected,
        );
        setTelegramStatusSnapshot(status);
        setConnectionState((prev) => ({
          ...prev,
          connected,
          loading: false,
          meta: connected ? formatTelegramMeta(status) : null,
          error: null,
        }));
        if (connected) {
          setTelegramFlowActive(false);
        }
        return;
      }
      setConnectionState((prev) => ({
        ...prev,
        connected: true,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setConnectionState((prev) => ({
        ...prev,
        connected: false,
        loading: false,
        error:
          err instanceof Error ? err.message : "Unable to check connection.",
      }));
    }
  }, [platform, selectionRequiresConnection, session?.accessToken]);

  useEffect(() => {
    const requiresConnection =
      selection === "self" && supportsConnection(platform);
    setSelectionRequiresConnection(requiresConnection);
  }, [selection, platform]);

  useEffect(() => {
    if (!selectionRequiresConnection) {
      setConnectionState({
        connected: true,
        loading: false,
        busy: false,
        error: null,
        meta: null,
      });
      setTelegramFlowActive(false);
      setTelegramStatusSnapshot(null);
      setSlackStatusData((prev) => (platform === "slack" ? prev : null));
      return;
    }
    if (!session?.accessToken) {
      setConnectionState({
        connected: false,
        loading: false,
        busy: false,
        error: "Sign in again to connect this channel.",
        meta: null,
      });
      return;
    }
    loadConnectionStatus();
  }, [
    selectionRequiresConnection,
    loadConnectionStatus,
    platform,
    session?.accessToken,
  ]);

  const { openFlow: openTelegramMtprotoFlow, modal: telegramMtprotoModal } =
    useTelegramMtprotoFlow({
      token: session?.accessToken ?? null,
      onCompleted: () => {
        void loadConnectionStatus();
        triggerTelegramContactsRefresh();
      },
    });

  const handleConnectPress = useCallback(async () => {
    if (
      !selectionRequiresConnection ||
      connectionState.connected ||
      connectionState.busy
    ) {
      return;
    }
    if (!session?.accessToken) {
      setConnectionState((prev) => ({
        ...prev,
        error: "Sign in again to connect this channel.",
      }));
      return;
    }
    setConnectionState((prev) => ({ ...prev, busy: true, error: null }));
    try {
      if (platform === "gmail") {
        await startGmailConnect(session.accessToken);
      } else if (platform === "outlook") {
        await startOutlookConnect(session.accessToken);
      } else if (platform === "slack") {
        await startSlackConnect(session.accessToken);
      } else if (platform === "telegram") {
        await startTelegramConnect(session.accessToken);
        setTelegramFlowActive(true);
      }
      await loadConnectionStatus();
    } catch (err) {
      if (platform === "telegram") {
        setTelegramFlowActive(false);
      }
      setConnectionState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Unable to connect this channel.",
      }));
    } finally {
      setConnectionState((prev) => ({ ...prev, busy: false }));
    }
  }, [
    connectionState.busy,
    connectionState.connected,
    loadConnectionStatus,
    platform,
    selectionRequiresConnection,
    session?.accessToken,
  ]);

  const gmailSelfComingSoon = platform === "gmail" && selection === "self";
  const connectionReady =
    !selectionRequiresConnection ||
    (connectionState.connected && !connectionState.loading);
  const canContinue = connectionReady && !gmailSelfComingSoon;

  const platformLabel = platformMeta[platform].label;

  useEffect(() => {
    if (!selectionRequiresConnection || platform !== "telegram") {
      setTelegramFlowActive(false);
      return;
    }
  }, [platform, selectionRequiresConnection]);

  useEffect(() => {
    if (platform !== "slack") {
      setSlackWorkspaceExpanded(false);
      setSlackUsersExpanded(false);
    }
    if (platform !== "telegram") {
      setTelegramPickerExpanded(false);
    }
  }, [platform]);

  useEffect(() => {
    if (!modalVisible) {
      setSlackWorkspaceExpanded(false);
      setSlackUsersExpanded(false);
      setTelegramPickerExpanded(false);
    }
  }, [modalVisible]);

  useEffect(() => {
    if (platform !== "slack") {
      setSlackUsers([]);
      setSlackUsersError(null);
      setSlackUsersLoading(false);
      return;
    }
    if (!slackTeamId) {
      setSlackUsers([]);
      setSlackUsersError(null);
      setSlackUsersLoading(false);
      setSlackUserId("");
      return;
    }
    const cachedUsers = slackUsersByWorkspace[slackTeamId];
    if (cachedUsers) {
      setSlackUsers(cachedUsers);
      setSlackUsersError(null);
      setSlackUsersLoading(false);
      setSlackUserId((prev) => {
        if (!prev || cachedUsers.some((user) => user.id === prev)) {
          return prev;
        }
        return "";
      });
      return;
    }
    if (!session?.accessToken) {
      return;
    }
    let cancelled = false;
    setSlackUsers([]);
    setSlackUsersError(null);
    setSlackUsersLoading(true);
    fetchSlackUsers(slackTeamId, session.accessToken)
      .then((users) => {
        if (cancelled) return;
        setSlackUsers(users);
        setSlackUsersByWorkspace((prev) => ({ ...prev, [slackTeamId]: users }));
        setSlackUserId((prev) => {
          if (!prev || users.some((user) => user.id === prev)) {
            return prev;
          }
          return "";
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setSlackUsers([]);
        setSlackUsersError(
          err instanceof Error ? err.message : "Unable to load Slack users.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setSlackUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [platform, session?.accessToken, slackTeamId, slackUsersByWorkspace]);

  useEffect(() => {
    if (platform !== "telegram") {
      setTelegramContacts([]);
      setTelegramContactsError(null);
      setTelegramContactsLoading(false);
      setTelegramPickerExpanded(false);
      return;
    }
    if (!session?.accessToken || !connectionState.connected) {
      setTelegramContacts([]);
      setTelegramContactsLoading(false);
      return;
    }
    let cancelled = false;
    setTelegramContactsError(null);
    setTelegramContactsLoading(true);
    fetchTelegramContacts(session.accessToken)
      .then((contacts) => {
        if (cancelled) return;
        const normalized = contacts
          .map((contact) => ({
            ...contact,
            chat_id: contact.chat_id != null ? String(contact.chat_id) : "",
          }))
          .filter((contact) => contact.chat_id);
        setTelegramContacts(normalized);
        const current = normalized.find(
          (contact) => contact.chat_id === telegramChatId,
        );
        if (current) {
          if (current.username) {
            const handle = current.username.startsWith("@")
              ? current.username
              : `@${current.username}`;
            setTelegramUsername(handle);
          } else {
            setTelegramUsername("");
          }
        } else {
          setTelegramChatId("");
          setTelegramUsername("");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setTelegramContacts([]);
        setTelegramContactsError(
          err instanceof Error
            ? err.message
            : "Unable to load Telegram Business contacts.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setTelegramContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    platform,
    session?.accessToken,
    connectionState.connected,
    telegramChatId,
    telegramContactsRefreshToken,
  ]);

  useEffect(() => {
    if (
      !selectionRequiresConnection ||
      platform !== "telegram" ||
      connectionState.connected ||
      !telegramFlowActive
    ) {
      return;
    }
    const interval = setInterval(() => {
      loadConnectionStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [
    selectionRequiresConnection,
    platform,
    telegramFlowActive,
    connectionState.connected,
    loadConnectionStatus,
  ]);

  const options: {
    id: DispatchMode;
    title: string;
    detail: string;
    badge?: string;
    disabled?: boolean;
  }[] = [
    {
      id: "proxy",
      title: "Send on your behalf",
      detail: `DueSoon delivers the reminder from a neutral ${platformLabel} inbox.`,
      disabled: !proxySupported.has(platform),
    },
    {
      id: "self",
      title: "Send as you",
      detail:
        "Connect your account so DueSoon mirrors your identity and signature.",
      badge: "Recommended",
    },
  ];

  const slackWorkspaceLabel = selectedSlackWorkspace
    ? (selectedSlackWorkspace.team_name ?? selectedSlackWorkspace.team_id)
    : "";
  const slackUserLabel =
    selectedSlackUser?.real_name ||
    selectedSlackUser?.display_name ||
    selectedSlackUser?.name ||
    "";
  const telegramContactSummary = useMemo(() => {
    if (!selectedTelegramContact) {
      return null;
    }
    const parts: string[] = [];
    const primary = selectedTelegramContact.name;
    if (primary) {
      parts.push(primary);
    }
    if (selectedTelegramContact.username) {
      const username = selectedTelegramContact.username.startsWith("@")
        ? selectedTelegramContact.username
        : `@${selectedTelegramContact.username}`;
      parts.push(username);
    }
    if (parts.length === 0) {
      return `Chat ${selectedTelegramContact.chat_id}`;
    }
    return parts.join(" · ");
  }, [selectedTelegramContact]);

  const openContactModal = () => {
    setContactError(null);
    setModalVisible(true);
  };

  const handleContinue = async () => {
    const fields: ContactFieldState = {
      label: contactLabel,
      email: contactEmail,
      phone: contactPhone,
      slackTeamId,
      slackUserId,
      telegramChatId,
      telegramUsername,
    };
    const validation = validateContactFields(platform, fields, {
      slackWorkspaceName: slackWorkspaceLabel,
      slackUserName: slackUserLabel,
      telegramContactSummary,
    });
    if (!validation.valid) {
      setContactError(validation.error);
      return;
    }

    if (persistedParams.clientId && persistedParams.contactMethodId) {
      await proceedToPayment({
        clientId: persistedParams.clientId,
        contactMethodId: persistedParams.contactMethodId,
        summaryValue: validation.summary,
      });
      return;
    }

    if (!session?.accessToken) {
      setContactError("Please sign in again to save this client.");
      return;
    }

    setSavingClient(true);
    try {
      const clientPayload = buildClientPayload(
        persistedParams,
        validation.contactPayload,
      );
      const client = await createClient(clientPayload, session.accessToken);
      const resolvedMethod = resolveContactMethod(
        client.contact_methods,
        validation.contactPayload,
      );
      await proceedToPayment({
        clientId: client.id,
        contactMethodId:
          resolvedMethod?.id ?? client.contact_methods[0]?.id ?? "",
        summaryValue: validation.summary,
      });
    } catch (err) {
      setContactError(
        err instanceof Error
          ? err.message
          : "Unable to save this client right now.",
      );
    } finally {
      setSavingClient(false);
    }
  };

  const proceedToPayment = async ({
    clientId,
    contactMethodId,
    summaryValue,
  }: {
    clientId: string;
    contactMethodId: string;
    summaryValue: string;
  }) => {
    if (!clientId || !contactMethodId) {
      setContactError("Missing client contact details. Please try again.");
      return;
    }
    setModalVisible(false);
    const savedDraftId = await ensureDraftSaved();
    const nextParams = {
      ...baseParams,
      platform,
      mode: selection,
      contact: summaryValue,
      contactLabel: contactLabel.trim(),
      clientId,
      contactMethodId,
      contactPhone,
      slackTeamId,
      slackUserId,
      telegramChatId,
      telegramUsername,
      ...(savedDraftId ? { draftId: savedDraftId } : {}),
    };
    router.push({
      pathname: "/new-reminder/payment-method",
      params: nextParams,
    });
  };

  const renderContactFields = () => {
    if (platform === "gmail" || platform === "outlook") {
      return (
        <>
          <Text style={styles.fieldLabel}>
            {platformMeta[platform].contactLabel}
          </Text>
          <TextInput
            style={[styles.input, contactError && styles.inputError]}
            placeholder={platformMeta[platform].placeholder}
            keyboardType={
              platformMeta[platform].keyboard as KeyboardTypeOptions
            }
            autoCapitalize="none"
            value={contactEmail}
            onChangeText={(text) => {
              setContactEmail(text);
              setContactError(null);
            }}
          />
        </>
      );
    }
    if (platform === "whatsapp") {
      return (
        <>
          <Text style={styles.fieldLabel}>WhatsApp Business number</Text>
          <TextInput
            style={[styles.input, contactError && styles.inputError]}
            placeholder={platformMeta.whatsapp.placeholder}
            keyboardType={platformMeta.whatsapp.keyboard as KeyboardTypeOptions}
            autoCapitalize="none"
            value={contactPhone}
            onChangeText={(text) => {
              setContactPhone(text);
              setContactError(null);
            }}
          />
        </>
      );
    }
    if (platform === "slack") {
      const noWorkspace = slackWorkspaces.length === 0;
      return (
        <>
          <Text style={styles.fieldLabel}>Slack workspace</Text>
          <Pressable
            style={[
              styles.selectInput,
              contactError && !slackTeamId && styles.inputError,
              noWorkspace && styles.selectInputDisabled,
            ]}
            onPress={() => {
              if (noWorkspace) return;
              setSlackWorkspaceExpanded((prev) => !prev);
              setSlackUsersExpanded(false);
              setContactError(null);
            }}
          >
            <Text
              style={
                slackWorkspaceLabel
                  ? styles.selectValue
                  : styles.selectPlaceholder
              }
            >
              {slackWorkspaceLabel ||
                (noWorkspace ? "No workspaces connected" : "Select workspace")}
            </Text>
            <Feather
              name={slackWorkspaceExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Theme.palette.slate}
            />
          </Pressable>
          {noWorkspace ? (
            <Text style={styles.helperText}>
              Connect Slack from Messaging connections to browse members.
            </Text>
          ) : null}
          {slackWorkspaceExpanded ? (
            <View style={styles.selectionList}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {slackWorkspaces.map((workspace) => {
                  const active = workspace.team_id === slackTeamId;
                  const label = workspace.team_name ?? workspace.team_id;
                  return (
                    <Pressable
                      key={workspace.team_id}
                      style={[
                        styles.selectionItem,
                        active && styles.selectionItemActive,
                      ]}
                      onPress={() => {
                        setSlackTeamId(workspace.team_id);
                        setSlackWorkspaceExpanded(false);
                        setSlackUsersExpanded(false);
                        setContactError(null);
                      }}
                    >
                      <Text style={styles.selectionItemName}>{label}</Text>
                      <Text style={styles.selectionItemDetail}>
                        {workspace.team_id}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>Slack person</Text>
          <Pressable
            style={[
              styles.selectInput,
              contactError && slackTeamId && !slackUserId && styles.inputError,
              (!slackTeamId || noWorkspace) && styles.selectInputDisabled,
            ]}
            onPress={() => {
              if (!slackTeamId || noWorkspace) {
                setContactError("Select a Slack workspace first.");
                return;
              }
              setSlackUsersExpanded((prev) => !prev);
              setSlackWorkspaceExpanded(false);
              setContactError(null);
            }}
          >
            <Text
              style={
                slackUserLabel ? styles.selectValue : styles.selectPlaceholder
              }
            >
              {slackUsersLoading
                ? "Loading members…"
                : slackUserLabel || "Select person"}
            </Text>
            <Feather
              name={slackUsersExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Theme.palette.slate}
            />
          </Pressable>
          {slackUsersError ? (
            <Text style={styles.helperTextError}>{slackUsersError}</Text>
          ) : null}
        {slackUsersExpanded ? (
          <View style={[styles.selectionList, styles.selectionListLarge]}>
            {slackUsersLoading ? (
              <View style={styles.selectionEmpty}>
                <ActivityIndicator color={Theme.palette.slate} />
              </View>
            ) : slackUsersError ? (
              <View style={styles.selectionEmpty}>
                <Text style={styles.helperTextError}>{slackUsersError}</Text>
              </View>
            ) : slackUsers.length === 0 ? (
              <Text style={styles.helperText}>
                No members found in this workspace.
              </Text>
            ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search members"
                    placeholderTextColor={Theme.palette.slate}
                    value={slackSearch}
                    onChangeText={setSlackSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {filteredSlackUsers.map((member) => {
                      const active = member.id === slackUserId;
                      const name =
                        member.real_name || member.display_name || member.name;
                      const detail =
                        member.display_name && member.display_name !== name
                          ? member.display_name
                          : member.name;
                      return (
                        <Pressable
                          key={member.id}
                        style={[
                          styles.selectionItem,
                          active && styles.selectionItemActive,
                        ]}
                        onPress={() => {
                          setSlackUserId(member.id);
                          setSlackUsersExpanded(false);
                          setContactError(null);
                          setSlackSearch("");
                        }}
                      >
                        <Text style={styles.selectionItemName}>{name}</Text>
                        <Text style={styles.selectionItemDetail}>{detail}</Text>
                      </Pressable>
                    );
                    })}
                    {filteredSlackUsers.length === 0 ? (
                      <View style={styles.selectionEmpty}>
                        <Text style={styles.helperText}>No matches.</Text>
                      </View>
                    ) : null}
                  </ScrollView>
                </>
              )}
            </View>
          ) : null}
        </>
      );
    }
    const mtprotoSupported = telegramStatusSnapshot?.mtproto_supported ?? false;
    const mtprotoInfo = mtprotoSupported
      ? telegramStatusSnapshot?.mtproto ?? null
      : null;
    const mtprotoConnected = Boolean(mtprotoInfo?.connected);
    return (
      <>
        <Text style={styles.fieldLabel}>Telegram Business chat</Text>
        <Pressable
          style={[
            styles.selectInput,
            contactError && !telegramChatId && styles.inputError,
            (!connectionState.connected || telegramContactsLoading) &&
              styles.selectInputDisabled,
          ]}
          onPress={() => {
            if (!connectionState.connected) {
              setContactError("Connect Telegram Business to select a chat.");
              return;
            }
            if (telegramContactsLoading) return;
            setTelegramPickerExpanded((prev) => !prev);
            setSlackWorkspaceExpanded(false);
            setSlackUsersExpanded(false);
            setContactError(null);
          }}
        >
          <Text
            style={
              telegramContactSummary
                ? styles.selectValue
                : styles.selectPlaceholder
            }
          >
            {telegramContactsLoading
              ? "Loading chats…"
              : telegramContactSummary || "Select chat"}
          </Text>
          <Feather
            name={telegramPickerExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={Theme.palette.slate}
          />
        </Pressable>
        {telegramContactsError ? (
          <Text style={styles.helperTextError}>{telegramContactsError}</Text>
        ) : null}
        {!telegramContactsLoading &&
        telegramContacts.length === 0 &&
        !telegramContactsError ? (
          <Text style={styles.helperText}>
            Start a Telegram Business conversation so it appears here. {"\n\n"}Only
            clients that have messaged after time of connection appear here.
          </Text>
        ) : null}
        {telegramPickerExpanded ? (
          <View style={[styles.selectionList, styles.selectionListLarge]}>
            {telegramContactsLoading ? (
              <View style={styles.selectionEmpty}>
                <ActivityIndicator color={Theme.palette.slate} />
              </View>
            ) : telegramContacts.length === 0 ? (
              <View style={styles.selectionEmpty}>
                <Text style={styles.helperText}>No chats available.</Text>
              </View>
            ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search chats"
                    placeholderTextColor={Theme.palette.slate}
                    value={telegramSearch}
                    onChangeText={setTelegramSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ScrollView keyboardShouldPersistTaps="handled">
                {filteredTelegramContacts.map((contact) => {
                  const chatId = String(contact.chat_id);
                  const active = chatId === telegramChatId;
                  const name =
                    contact.name || contact.username || `Chat ${chatId}`;
                  const username = contact.username
                    ? contact.username.startsWith("@")
                      ? contact.username
                      : `@${contact.username}`
                    : "";
                  const detailParts: string[] = [];
                  if (username) detailParts.push(username);
                  if (contact.assigned_client_id)
                    detailParts.push("Linked client");
                  const detail = detailParts.join(" · ");
                  const lastMessage = contact.last_message || null;
                  return (
                    <Pressable
                      key={chatId}
                      style={[
                        styles.selectionItem,
                        active && styles.selectionItemActive,
                      ]}
                      onPress={() => {
                        setTelegramChatId(chatId);
                        setTelegramUsername(username);
                        setTelegramPickerExpanded(false);
                        setContactError(null);
                        setTelegramSearch("");
                      }}
                    >
                      <Text style={styles.selectionItemName}>{name}</Text>
                      {detail ? (
                        <Text style={styles.selectionItemDetail}>{detail}</Text>
                      ) : null}
                      {lastMessage ? (
                        <Text
                          style={styles.selectionItemNote}
                          numberOfLines={2}
                        >
                          {lastMessage}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
                  {filteredTelegramContacts.length === 0 ? (
                    <View style={styles.selectionEmpty}>
                      <Text style={styles.helperText}>No matches.</Text>
                    </View>
                  ) : null}
                </>
            )}
          </View>
        ) : null}
        {mtprotoSupported ? (
          <View style={styles.telegramAccountCard}>
            <Text style={styles.helperText}>
              {mtprotoConnected
                ? "Telegram account session is active."
                : "Connect your Telegram account so DueSoon can keep conversations fresh."}
            </Text>
            {mtprotoInfo?.last_error ? (
              <Text style={styles.helperTextError}>
                Session issue: {mtprotoInfo.last_error}
              </Text>
            ) : null}
            <Pressable
              style={styles.telegramAccountButton}
              onPress={() =>
                openTelegramMtprotoFlow(mtprotoInfo?.phone_number ?? undefined)
              }
            >
              <Text style={styles.telegramAccountButtonText}>
                {mtprotoConnected
                  ? "Reconnect Telegram account"
                  : "Connect Telegram account"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navRow}>
          <Pressable style={styles.backLink} onPress={handleBack}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Choose platform</Text>
          </Pressable>
          {draftId ? (
            <Pressable
              style={styles.remindersLink}
              onPress={handleReturnToReminders}
            >
              <Feather name="home" size={18} color={Theme.palette.slate} />
              <Text style={styles.remindersLabel}>Reminders</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>How should we send it?</Text>
          <Text style={styles.subtitle}>
            Decide whether DueSoon keeps the reminder anonymous or sends it
            directly through your {platformLabel} account.
          </Text>
          {platform === "gmail" || platform === "outlook" ? (
            <Pressable
              style={styles.platformLink}
              onPress={async () => {
                await Haptics.selectionAsync();
                const currentPlatform = platform;
                const next = currentPlatform === "gmail" ? "outlook" : "gmail";
                const requiresConnection =
                  selection === "self" && supportsConnection(next);
                setPlatform(next);
                setSelectionRequiresConnection(requiresConnection);
                setConnectionState({
                  connected: !requiresConnection,
                  loading: requiresConnection,
                  busy: false,
                  error: null,
                  meta: null,
                });
                setContactLabel((prev) => {
                  if (persistedParams.contactLabel) return prev;
                  const previousDefault = buildContactLabelDefault(
                    currentPlatform,
                    clientName,
                  );
                  const nextDefault = buildContactLabelDefault(
                    next,
                    clientName,
                  );
                  return prev === previousDefault ? nextDefault : prev;
                });
              }}
            >
              <Text style={styles.platformLinkText}>
                Use {platform === "gmail" ? "Outlook" : "Gmail"} instead
              </Text>
              <Feather
                name="external-link"
                size={14}
                color={Theme.palette.slate}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.optionStack}>
          {options.map((option) => {
            if (option.disabled) {
              return null;
            }
            const active = selection === option.id;
            const gmailSelfOption = platform === "gmail" && option.id === "self";
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelection(option.id)}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  {option.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeLabel}>{option.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.optionDetail}>{option.detail}</Text>
                {active ? (
                  option.id === "self" ? (
                    supportsConnection(platform) ? (
                      gmailSelfOption ? (
                        <View style={styles.noteBox}>
                          <Feather
                            name="clock"
                            size={16}
                            color={Theme.palette.slate}
                          />
                          <Text style={styles.noteText}>
                            Send as you via Gmail is coming soon. Choose “Send
                            on your behalf” or another platform to keep going.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.connectBox}>
                          <Text style={styles.connectTitle}>
                            Connect {platformLabel}
                          </Text>
                          <Text style={styles.connectDetail}>
                            DueSoon sends directly from your {platformLabel}{" "}
                            account so messages feel personal.
                          </Text>
                          {connectionState.meta ? (
                            <Text style={styles.connectMeta}>
                              {connectionState.meta}
                            </Text>
                          ) : null}
                          {connectionState.error ? (
                            <Text style={styles.errorText}>
                              {connectionState.error}
                            </Text>
                          ) : null}
                          <Pressable
                            style={[
                              styles.connectButton,
                              connectionState.connected &&
                                styles.connectButtonConnected,
                              (connectionState.busy ||
                                connectionState.loading) &&
                                styles.connectButtonDisabled,
                            ]}
                            disabled={
                              connectionState.connected ||
                              connectionState.busy ||
                              connectionState.loading
                            }
                            onPress={async () => {
                              await Haptics.selectionAsync();
                              await handleConnectPress();
                            }}
                          >
                            {connectionState.connected ? (
                              <View style={styles.connectButtonContent}>
                                <Feather name="check" size={14} color="#FFFFFF" />
                                <Text style={styles.connectButtonText}>
                                  Connected
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.connectButtonText}>
                                {connectionState.busy
                                  ? "Connecting..."
                                  : connectionState.loading
                                    ? "Checking..."
                                    : `Connect ${platformLabel}`}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      )
                    ) : (
                      <View style={styles.noteBox}>
                        <Feather
                          name="info"
                          size={16}
                          color={Theme.palette.slate}
                        />
                        <Text style={styles.noteText}>
                          We’ll send via your {platformLabel} identity
                          automatically.
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.noteBox}>
                      <Feather
                        name="shield"
                        size={16}
                        color={Theme.palette.slate}
                      />
                      <Text style={styles.noteText}>
                        DueSoon shares a compliance-friendly inbox with read
                        receipts so you never double send.
                      </Text>
                    </View>
                  )
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            (!canContinue || savingClient) && styles.primaryButtonDisabled,
            pressed && canContinue && styles.primaryButtonPressed,
          ]}
          disabled={!canContinue}
          onPress={async () => {
            if (!canContinue) return;
            if (
              platform === "telegram" &&
              selection === "self" &&
              connectionState.connected
            ) {
              triggerTelegramContactsRefresh();
            }
            await Haptics.selectionAsync();
            openContactModal();
          }}
        >
          <Text style={styles.primaryButtonText}>
            Use {selectionLabel(selection)} via {platformLabel}
          </Text>
        </Pressable>
        {gmailSelfComingSoon ? (
          <Text style={styles.connectionHint}>
            Send as you via Gmail is coming soon. Choose “Send on your behalf”
            or another platform to continue.
          </Text>
        ) : selectionRequiresConnection && !connectionState.connected ? (
          <Text style={styles.connectionHint}>
            Connect {platformLabel} to continue.
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCardWrap}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Client contact</Text>
              <Text style={styles.modalSubtitle}>
                DueSoon needs the client’s contact details for {platformLabel}{" "}
                before scheduling the reminder.
              </Text>
              <Text style={styles.fieldLabel}>Contact label</Text>
              <TextInput
                style={styles.input}
                placeholder={buildContactLabelDefault(platform, clientName)}
                value={contactLabel}
                onChangeText={(text) => {
                  setContactError(null);
                  setContactLabel(text);
                }}
              />
              {renderContactFields()}
              {contactError ? (
                <Text style={styles.errorText}>{contactError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButtonMuted,
                    pressed && styles.modalButtonMutedPressed,
                  ]}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalButtonMutedText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    savingClient && styles.modalButtonDisabled,
                    pressed && !savingClient && styles.modalButtonPressed,
                  ]}
                  disabled={savingClient}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    handleContinue();
                  }}
                >
                  <Text style={styles.modalButtonText}>
                    {savingClient ? "Saving..." : "Continue"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      {telegramMtprotoModal}
    </SafeAreaView>
  );
}

function selectionLabel(mode: DispatchMode) {
  return mode === "self" ? "Send as you" : "Send on your behalf";
}

function validateContactFields(
  platform: PlatformId,
  fields: ContactFieldState,
  options?: {
    slackWorkspaceName?: string | null;
    slackUserName?: string | null;
    telegramContactSummary?: string | null;
  },
): ValidationResult {
  const trimmedLabel = fields.label.trim();
  if (!trimmedLabel) {
    return {
      valid: false,
      error: "Add a label so you recognize the contact later.",
    };
  }
  if (platform === "gmail" || platform === "outlook") {
    if (!fields.email.trim()) {
      return { valid: false, error: "Enter the client's email." };
    }
    return {
      valid: true,
      contactPayload: {
        type: "email",
        label: trimmedLabel,
        email: fields.email.trim(),
      },
      summary: fields.email.trim(),
    };
  }
  if (platform === "whatsapp") {
    if (!fields.phone.trim()) {
      return { valid: false, error: "Enter the WhatsApp Business number." };
    }
    return {
      valid: true,
      contactPayload: {
        type: "whatsapp",
        label: trimmedLabel,
        phone: fields.phone.trim(),
      },
      summary: fields.phone.trim(),
    };
  }
  if (platform === "slack") {
    if (!fields.slackTeamId.trim() || !fields.slackUserId.trim()) {
      return { valid: false, error: "Select a Slack workspace and person." };
    }
    const summaryParts: string[] = [];
    if (options?.slackUserName?.trim()) {
      summaryParts.push(options.slackUserName.trim());
    }
    if (options?.slackWorkspaceName?.trim()) {
      summaryParts.push(options.slackWorkspaceName.trim());
    }
    if (summaryParts.length === 0) {
      summaryParts.push(`User ${fields.slackUserId.trim()}`);
      summaryParts.push(`Workspace ${fields.slackTeamId.trim()}`);
    }
    return {
      valid: true,
      contactPayload: {
        type: "slack",
        label: trimmedLabel,
        slack_team_id: fields.slackTeamId.trim(),
        slack_user_id: fields.slackUserId.trim(),
      },
      summary: summaryParts.join(" · "),
    };
  }
  if (!fields.telegramChatId.trim()) {
      return { valid: false, error: "Select a Telegram Business chat." };
  }
  return {
    valid: true,
    contactPayload: {
      type: "telegram",
      label: trimmedLabel,
      telegram_chat_id: fields.telegramChatId.trim(),
      telegram_username: fields.telegramUsername.trim() || undefined,
    },
    summary:
      options?.telegramContactSummary ??
      (fields.telegramUsername.trim()
        ? `${fields.telegramUsername.trim()} (${fields.telegramChatId.trim()})`
        : fields.telegramChatId.trim()),
  };
}

function buildClientPayload(
  params: Record<string, string>,
  contactPayload: ContactMethodPayload,
): ClientCreatePayload {
  return {
    name: params.client ?? "Client",
    company_name: params.businessName || undefined,
    notes: params.notes || undefined,
    client_type:
      (params.clientType as ClientCreatePayload["client_type"]) ?? "business",
    contact_methods: [contactPayload],
  };
}

function resolveContactMethod(
  contactMethods: ContactMethod[],
  payload: ContactMethodPayload,
) {
  return contactMethods.find((method) => {
    if (method.type !== payload.type) return false;
    if (payload.email && method.email === payload.email) return true;
    if (payload.phone && method.phone === payload.phone) return true;
    if (payload.slack_team_id && method.slack_team_id === payload.slack_team_id)
      return true;
    if (
      payload.telegram_chat_id &&
      method.telegram_chat_id === payload.telegram_chat_id
    )
      return true;
    return false;
  });
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

function buildContactLabelDefault(platform: PlatformId, clientName?: string) {
  const trimmed = clientName?.trim();
  if (trimmed) {
    return `${trimmed} contact`;
  }
  return `${platformMeta[platform].label} contact`;
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  remindersLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  remindersLabel: {
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
  platformLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
  },
  platformLinkText: {
    fontSize: 14,
    color: Theme.palette.slate,
    fontWeight: "500",
  },
  optionStack: {
    gap: Theme.spacing.md,
  },
  optionCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  optionCardActive: {
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.08)",
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  optionDetail: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
    backgroundColor: Theme.palette.surface,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  connectBox: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  connectTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  connectDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
    lineHeight: 18,
  },
  connectButton: {
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.ink,
  },
  connectButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  connectButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  connectButtonConnected: {
    backgroundColor: Theme.palette.success,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectMeta: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  noteBox: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
    alignItems: "center",
  },
  noteText: {
    fontSize: 13,
    color: Theme.palette.slate,
    flex: 1,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonPressed: {
    backgroundColor: Theme.palette.ink,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  connectionHint: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  modalScroll: {
    width: "100%",
  },
  modalCardWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: Theme.radii.lg,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Theme.palette.slate,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  inputError: {
    borderColor: Theme.palette.accent,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: Theme.palette.ink,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectInputDisabled: {
    opacity: 0.6,
  },
  selectValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  selectPlaceholder: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  selectionList: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    marginTop: Theme.spacing.xs,
    maxHeight: 200,
    backgroundColor: "#FFFFFF",
  },
  selectionListLarge: {
    maxHeight: 260,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    fontSize: 15,
    color: Theme.palette.ink,
    marginHorizontal: Theme.spacing.sm,
  },
  selectionItem: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
  },
  selectionItemActive: {
    backgroundColor: Theme.palette.surface,
  },
  selectionItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  selectionItemDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  selectionItemNote: {
    fontSize: 12,
    color: Theme.palette.inkMuted,
    marginTop: 2,
  },
  selectionEmpty: {
    padding: Theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  helperTextError: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  telegramAccountCard: {
    marginTop: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    backgroundColor: Theme.palette.surface,
    gap: Theme.spacing.xs,
  },
  telegramAccountButton: {
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.ink,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
  },
  telegramAccountButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: Theme.palette.border,
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radii.lg,
    overflow: "hidden",
  },
  modalButtonMuted: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderColor: Theme.palette.border,
  },
  modalButtonMutedPressed: {
    backgroundColor: Theme.palette.surface,
  },
  modalButtonMutedText: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.slate,
  },
  modalButtonPressed: {
    backgroundColor: Theme.palette.ink,
  },
  modalButtonDisabled: {
    opacity: 0.65,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

function supportsConnection(id: PlatformId) {
  return (
    id === "gmail" || id === "outlook" || id === "slack" || id === "telegram"
  );
}

function formatExpiry(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Expires ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function formatGmailMeta(status: GmailStatus) {
  if (!status.connected) return null;
  return formatExpiry(status.expires_at);
}

function formatOutlookMeta(status: OutlookStatus) {
  if (!status.connected) return null;
  const parts: string[] = [];
  if (status.email_address) {
    parts.push(status.email_address);
  }
  const expiry = formatExpiry(status.expires_at);
  if (expiry) parts.push(expiry);
  return parts.join(" · ") || null;
}

function formatSlackMeta(status: SlackStatus) {
  const count = status.workspaces?.length ?? 0;
  if (!count) return null;
  return `${count} connected workspace${count === 1 ? "" : "s"}`;
}

function formatTelegramMeta(status: TelegramStatus) {
  const parts: string[] = [];
  const username = status.connection?.telegram_username;
  if (username) {
    parts.push(username.startsWith("@") ? username : `@${username}`);
  }
  if (status.mtproto?.connected) {
    parts.push("Account session ready");
  } else if (status.mtproto?.last_error) {
    parts.push("Session needs attention");
  }
  return parts.join(" · ") || null;
}

function formatAmountDisplay(amount?: string, currency?: string) {
  if (!amount) return null;
  if (/[A-Za-z$€£¥₹₦₽₱₴₭₮₩]/.test(amount)) {
    return amount;
  }
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

function getRedirectUri() {
  if (ENV_OAUTH_REDIRECT) {
    return ENV_OAUTH_REDIRECT;
  }
  return AuthSession.makeRedirectUri({
    scheme: Platform.select({ web: undefined, default: "ambeduesoon" }),
  });
}

function parseQueryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }
    return params;
  } catch {
    const fallback = Linking.parse(url);
    Object.entries(fallback.queryParams ?? {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        params[key] = value;
      }
    });
    return params;
  }
}

async function startGmailConnect(token: string) {
  const redirectUri = getRedirectUri();
  const status = await fetchGmailStatus(token, { redirectUri });
  const onboardingUrl = status.onboarding_url;
  if (!onboardingUrl) {
    throw new Error(
      "Unable to start the Gmail consent flow. Please try again.",
    );
  }
  const result = await WebBrowser.openAuthSessionAsync(
    onboardingUrl,
    redirectUri,
  );
  if (result.type !== "success" || !result.url) {
    throw new Error("Gmail connection was canceled.");
  }
  const params = parseQueryParams(result.url);
  const code = params.code;
  const state = params.state;
  if (!code || !state) {
    throw new Error(
      "Gmail did not return the required credentials. Please try again.",
    );
  }
  await connectGmailAccount({ code, state, redirectUri }, token);
}

async function startOutlookConnect(token: string) {
  const redirectUri = getRedirectUri();
  const status = await fetchOutlookStatus(token, { redirectUri });
  const onboardingUrl = status.onboarding_url;
  if (!onboardingUrl) {
    throw new Error(
      "Unable to start the Outlook consent flow. Please try again.",
    );
  }
  const result = await WebBrowser.openAuthSessionAsync(
    onboardingUrl,
    redirectUri,
  );
  if (result.type !== "success" || !result.url) {
    throw new Error("Outlook connection was canceled.");
  }
  const params = parseQueryParams(result.url);
  const code = params.code;
  const state = params.state;
  if (!code || !state) {
    throw new Error(
      "Outlook did not return the required credentials. Please try again.",
    );
  }
  await connectOutlookAccount({ code, state, redirectUri }, token);
}

async function startSlackConnect(token: string) {
  const redirectUri = getRedirectUri();
  const status = await fetchSlackStatus(token, { redirectUri });
  const onboardingUrl = status.onboarding_url;
  if (!onboardingUrl) {
    throw new Error(
      "Unable to start the Slack consent flow. Please try again.",
    );
  }
  const result = await WebBrowser.openAuthSessionAsync(
    onboardingUrl,
    redirectUri,
  );
  if (result.type !== "success" || !result.url) {
    throw new Error("Slack connection was canceled.");
  }
  const params = parseQueryParams(result.url);
  const code = params.code;
  const state = params.state;
  if (!code || !state) {
    throw new Error(
      "Slack did not return the required credentials. Please try again.",
    );
  }
  await connectSlackAccount({ code, state, redirectUri }, token);
}

async function startTelegramConnect(token: string) {
  const status = await fetchTelegramStatus(token);
  const onboardingUrl =
    status.connection?.onboarding_url ?? status.onboarding_url;
  if (!onboardingUrl) {
    throw new Error("Unable to open Telegram Business. Please try again.");
  }
  await Linking.openURL(onboardingUrl);
}
