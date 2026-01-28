import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CONTACT_PLATFORM_INFO,
  CONTACT_PLATFORM_OPTIONS,
  ContactPlatformId,
} from "@/constants/contact-platforms";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { connectChannel, disconnectChannel } from "@/services/channels";
import {
  connectGmailAccount,
  disconnectGmailAccount,
  fetchGmailStatus,
  GmailStatus,
} from "@/services/gmail";
import {
  connectOutlookAccount,
  disconnectOutlookAccount,
  fetchOutlookStatus,
  OutlookStatus,
} from "@/services/outlook";
import {
  connectSlackAccount,
  fetchSlackStatus,
  SlackStatus,
} from "@/services/slack";
import {
  disconnectTelegram,
  fetchTelegramStatus,
  TelegramStatus,
} from "@/services/telegram";

WebBrowser.maybeCompleteAuthSession();

const ENV_OAUTH_REDIRECT = process.env.EXPO_PUBLIC_GMAIL_REDIRECT_URL;

const GMAIL_STATUS_CACHE_KEY = "cache.messaging.gmailStatus";
const OUTLOOK_STATUS_CACHE_KEY = "cache.messaging.outlookStatus";
const SLACK_STATUS_CACHE_KEY = "cache.messaging.slackStatus";
const TELEGRAM_STATUS_CACHE_KEY = "cache.messaging.telegramStatus";

function getAppRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: Platform.select({ web: undefined, default: "ambeduesoon" }),
  });
}

function getServerRedirectUri() {
  return ENV_OAUTH_REDIRECT ?? getAppRedirectUri();
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

export default function MessagingConnectionsScreen() {
  const router = useRouter();
  const { user, session, updateUserProfile } = useAuth();
  const [connections, setConnections] = useState<
    Record<ContactPlatformId, boolean>
  >(() => ({
    gmail: user?.channels?.gmail ?? false,
    outlook: user?.channels?.outlook ?? false,
    slack: user?.channels?.slack ?? false,
    whatsapp: user?.channels?.whatsapp ?? false,
    telegram: user?.channels?.telegram ?? false,
    discord: user?.channels?.discord ?? false,
  }));
  const [busy, setBusy] = useState<Record<ContactPlatformId, boolean>>({
    gmail: false,
    outlook: false,
    slack: false,
    whatsapp: false,
    telegram: false,
    discord: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus | null>(
    null,
  );
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(
    null,
  );
  const [telegramFlowActive, setTelegramFlowActive] = useState(false);
  const telegramChannelStateRef = useRef<boolean | null>(
    user?.channels?.telegram ?? null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{
    id: ContactPlatformId;
    label: string;
  } | null>(null);

  useEffect(() => {
    telegramChannelStateRef.current = user?.channels?.telegram ?? null;
  }, [user?.channels?.telegram]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromCache = async () => {
      const [cachedGmail, cachedOutlook, cachedSlack, cachedTelegram] =
        await Promise.all([
          getCachedValue<GmailStatus>(GMAIL_STATUS_CACHE_KEY),
          getCachedValue<OutlookStatus>(OUTLOOK_STATUS_CACHE_KEY),
          getCachedValue<SlackStatus>(SLACK_STATUS_CACHE_KEY),
          getCachedValue<TelegramStatus>(TELEGRAM_STATUS_CACHE_KEY),
        ]);
      if (cancelled) return;
      if (cachedGmail) {
        setGmailStatus(cachedGmail);
        setConnections((prev) =>
          prev.gmail === cachedGmail.connected
            ? prev
            : { ...prev, gmail: Boolean(cachedGmail.connected) },
        );
      }
      if (cachedOutlook) {
        setOutlookStatus(cachedOutlook);
        setConnections((prev) =>
          prev.outlook === cachedOutlook.connected
            ? prev
            : { ...prev, outlook: Boolean(cachedOutlook.connected) },
        );
      }
      if (cachedSlack) {
        setSlackStatus(cachedSlack);
        const connected = (cachedSlack.workspaces?.length ?? 0) > 0;
        setConnections((prev) =>
          prev.slack === connected ? prev : { ...prev, slack: connected },
        );
      }
      if (cachedTelegram) {
        setTelegramStatus(cachedTelegram);
        const connected = Boolean(
          cachedTelegram.has_business_connection &&
          cachedTelegram.connection?.connected,
        );
        setConnections((prev) =>
          prev.telegram === connected ? prev : { ...prev, telegram: connected },
        );
      }
    };
    hydrateFromCache();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncTelegramChannelState = useCallback(
    async (connected: boolean) => {
      if (telegramChannelStateRef.current === connected) {
        return;
      }
      const previous = telegramChannelStateRef.current;
      telegramChannelStateRef.current = connected;
      try {
        await updateUserProfile({ channels: { telegram: connected } });
      } catch (err) {
        telegramChannelStateRef.current = previous;
        console.warn("Failed to sync Telegram channel state", err);
      }
    },
    [updateUserProfile],
  );

  const loadGmailStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    try {
      const status = await fetchGmailStatus(session.accessToken);
      setGmailStatus(status);
      await setCachedValue(GMAIL_STATUS_CACHE_KEY, status);
      if (status.connected !== connections.gmail) {
        setConnections((prev) => ({ ...prev, gmail: status.connected }));
      }
    } catch (err) {
      console.warn("Failed to load Gmail status", err);
    }
  }, [connections.gmail, session?.accessToken]);

  useEffect(() => {
    loadGmailStatus();
  }, [loadGmailStatus]);

  const loadOutlookStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    try {
      const status = await fetchOutlookStatus(session.accessToken);
      setOutlookStatus(status);
      await setCachedValue(OUTLOOK_STATUS_CACHE_KEY, status);
      if (status.connected !== connections.outlook) {
        setConnections((prev) => ({ ...prev, outlook: status.connected }));
      }
    } catch (err) {
      console.warn("Failed to load Outlook status", err);
    }
  }, [connections.outlook, session?.accessToken]);

  useEffect(() => {
    loadOutlookStatus();
  }, [loadOutlookStatus]);

  const loadSlackStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    try {
      const status = await fetchSlackStatus(session.accessToken);
      setSlackStatus(status);
      await setCachedValue(SLACK_STATUS_CACHE_KEY, status);
      const connected = (status.workspaces?.length ?? 0) > 0;
      if (connected !== connections.slack) {
        setConnections((prev) => ({ ...prev, slack: connected }));
      }
    } catch (err) {
      console.warn("Failed to load Slack status", err);
    }
  }, [connections.slack, session?.accessToken]);

  useEffect(() => {
    loadSlackStatus();
  }, [loadSlackStatus]);
  useFocusEffect(
    useCallback(() => {
      loadSlackStatus();
    }, [loadSlackStatus]),
  );

  const loadTelegramStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return null;
    }
    try {
      const status = await fetchTelegramStatus(session.accessToken);
      setTelegramStatus(status);
      await setCachedValue(TELEGRAM_STATUS_CACHE_KEY, status);
      const isConnected = Boolean(
        status.has_business_connection && status.connection?.connected,
      );
      setConnections((prev) => {
        if (prev.telegram === isConnected) {
          return prev;
        }
        return { ...prev, telegram: isConnected };
      });
      void syncTelegramChannelState(isConnected);
      return status;
    } catch (err) {
      console.warn("Failed to load Telegram status", err);
      return null;
    }
  }, [session?.accessToken, syncTelegramChannelState]);

  useEffect(() => {
    loadTelegramStatus();
  }, [loadTelegramStatus]);

  const openTelegramOnboarding = useCallback(async () => {
    const latestStatus = telegramStatus ?? (await loadTelegramStatus());
    const onboardingUrl =
      latestStatus?.connection?.onboarding_url ?? latestStatus?.onboarding_url;
    if (!onboardingUrl) {
      throw new Error("Unable to open Telegram. Please try again.");
    }
    await Linking.openURL(onboardingUrl);
    setTelegramFlowActive(true);
  }, [loadTelegramStatus, telegramStatus]);

  useEffect(() => {
    if (telegramStatus?.has_business_connection) {
      setTelegramFlowActive(false);
    }
  }, [telegramStatus?.has_business_connection]);

  useEffect(() => {
    if (!telegramStatus) {
      return;
    }
    if (telegramStatus.has_business_connection) {
      return;
    }
    if (!telegramStatus.has_started_bot) {
      return;
    }
    const interval = setInterval(() => {
      loadTelegramStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTelegramStatus, telegramStatus]);

  const formatExpiry = (iso?: string) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return `Expires ${date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
  };

  const connectionList = useMemo(
    () =>
      CONTACT_PLATFORM_OPTIONS.map((platform) => ({
        ...platform,
        info: CONTACT_PLATFORM_INFO[platform.id],
        connected: connections[platform.id],
        meta: (() => {
          if (platform.id === "gmail" && gmailStatus?.connected) {
            return formatExpiry(gmailStatus.expires_at);
          }
          if (platform.id === "outlook" && outlookStatus?.connected) {
            const parts: string[] = [];
            if (outlookStatus.email_address) {
              parts.push(outlookStatus.email_address);
            }
            const expiry = formatExpiry(outlookStatus.expires_at);
            if (expiry) {
              parts.push(expiry);
            }
            return parts.join(" · ") || undefined;
          }
          if (
            platform.id === "slack" &&
            (slackStatus?.workspaces?.length ?? 0) > 0
          ) {
            const parts: string[] = [];
            const count = slackStatus.workspaces?.length ?? 0;
            if (count > 0) {
              parts.push(`${count} workspace${count === 1 ? "" : "s"}`);
            }
            return parts.join(" · ") || undefined;
          }
          if (
            platform.id === "telegram" &&
            telegramStatus?.connection?.connected
          ) {
            const username = telegramStatus.connection.telegram_username;
            if (username) {
              return username.startsWith("@") ? username : `@${username}`;
            }
          }
          return undefined;
        })(),
      })),
    [connections, gmailStatus, outlookStatus, slackStatus, telegramStatus],
  );

  const toggleConnection = async (id: ContactPlatformId) => {
    if (!session?.accessToken || busy[id]) {
      return;
    }
    if (connections[id]) {
      if (id === "slack") {
        router.push("/settings/slack");
        return;
      }
      const platformInfo = CONTACT_PLATFORM_INFO[id];
      setConfirmDisconnect({ id, label: platformInfo?.label ?? id });
      return;
    }
    setError(null);
    setBusy((prev) => ({ ...prev, [id]: true }));
    Haptics.selectionAsync();

    if (id === "gmail") {
      try {
        if (connections.gmail) {
          await disconnectGmailAccount(session.accessToken);
          await updateUserProfile({ channels: { gmail: false } });
          setConnections((prev) => ({ ...prev, gmail: false }));
          setGmailStatus({ connected: false });
        } else {
          const browserRedirectUri = getAppRedirectUri();
          const serverRedirectUri = getServerRedirectUri();
          console.log(
            "Gmail redirect URI",
            serverRedirectUri,
            browserRedirectUri,
          );
          const status = await fetchGmailStatus(session.accessToken, {
            redirectUri: serverRedirectUri,
          });
          const onboardingUrl = status.onboarding_url;
          if (!onboardingUrl) {
            throw new Error(
              "Unable to start the Gmail consent flow. Please try again.",
            );
          }
          const result = await WebBrowser.openAuthSessionAsync(
            onboardingUrl,
            browserRedirectUri,
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
          await connectGmailAccount(
            {
              code,
              state,
              redirectUri: serverRedirectUri,
            },
            session.accessToken,
          );
          await updateUserProfile({ channels: { gmail: true } });
          setConnections((prev) => ({ ...prev, gmail: true }));
          await loadGmailStatus();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update Gmail connection.",
        );
      } finally {
        setBusy((prev) => ({ ...prev, [id]: false }));
      }
      return;
    }

    if (id === "outlook") {
      try {
        if (connections.outlook) {
          await disconnectOutlookAccount(session.accessToken);
          await updateUserProfile({ channels: { outlook: false } });
          setConnections((prev) => ({ ...prev, outlook: false }));
          setOutlookStatus({ connected: false });
        } else {
          const redirectUri = getServerRedirectUri();
          const status = await fetchOutlookStatus(session.accessToken, {
            redirectUri,
          });
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
          await connectOutlookAccount(
            {
              code,
              state,
              redirectUri,
            },
            session.accessToken,
          );
          await updateUserProfile({ channels: { outlook: true } });
          setConnections((prev) => ({ ...prev, outlook: true }));
          await loadOutlookStatus();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update Outlook connection.",
        );
      } finally {
        setBusy((prev) => ({ ...prev, [id]: false }));
      }
      return;
    }

    if (id === "slack") {
      try {
        if (connections.slack) {
          router.push("/settings/slack");
        } else {
          const redirectUri = getServerRedirectUri();
          const status = await fetchSlackStatus(session.accessToken, {
            redirectUri,
          });
          setSlackStatus(status);
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
          await connectSlackAccount(
            {
              code,
              state,
              redirectUri,
            },
            session.accessToken,
          );
          await updateUserProfile({ channels: { slack: true } });
          setConnections((prev) => ({ ...prev, slack: true }));
          await loadSlackStatus();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update Slack connection.",
        );
      } finally {
        setBusy((prev) => ({ ...prev, [id]: false }));
      }
      return;
    }

    if (id === "telegram") {
      try {
        if (connections.telegram) {
          await disconnectTelegram(session.accessToken);
          await updateUserProfile({ channels: { telegram: false } });
          telegramChannelStateRef.current = false;
          setConnections((prev) => ({ ...prev, telegram: false }));
          setTelegramFlowActive(false);
          await loadTelegramStatus();
        } else {
          await openTelegramOnboarding();
          await loadTelegramStatus();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update Telegram connection.",
        );
      } finally {
        setBusy((prev) => ({ ...prev, [id]: false }));
      }
      return;
    }

    const currentlyConnected = connections[id];
    if (currentlyConnected) {
      setConfirmDisconnect({
        id,
        label: CONTACT_PLATFORM_INFO[id]?.label ?? id,
      });
      return;
    }
    setConnections((prev) => ({ ...prev, [id]: !currentlyConnected }));
    try {
      await connectChannel(id, session.accessToken);
      await updateUserProfile({
        channels: {
          [id]: true,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update connection. Please try again.",
      );
      setConnections((prev) => ({ ...prev, [id]: currentlyConnected }));
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([
        loadGmailStatus(),
        loadOutlookStatus(),
        loadSlackStatus(),
        loadTelegramStatus(),
      ]);
    } catch (error) {
      console.warn("Failed to refresh messaging connections", error);
    } finally {
      setRefreshing(false);
    }
  }, [
    loadGmailStatus,
    loadOutlookStatus,
    loadSlackStatus,
    loadTelegramStatus,
    session?.accessToken,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Theme.palette.ink}
          />
        }
      >
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to settings</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Messaging connections</Text>
          <Text style={styles.subtitle}>
            Connect email and messaging accounts so reminders can send from the
            channels your clients expect.
          </Text>
        </View>

        <View style={styles.card}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {connectionList.map((platform, index) => {
            const isTelegram = platform.id === "telegram";
            const telegramStarted = telegramStatus?.has_started_bot ?? false;
            const telegramBusinessConnected =
              telegramStatus?.has_business_connection ?? false;
            const showTelegramSteps = isTelegram && !platform.connected;
            const showBusinessChecklist =
              telegramStarted && !telegramBusinessConnected;
            const onboardingUrl =
              telegramStatus?.connection?.onboarding_url ??
              telegramStatus?.onboarding_url;
            const canOpenTelegram = Boolean(onboardingUrl);
            return (
              <View
                key={platform.id}
                style={[
                  styles.platformRow,
                  index === connectionList.length - 1 && styles.rowLast,
                  platform.connected && styles.connectedRow,
                ]}
              >
                <View style={styles.platformInfo}>
                  <View style={styles.iconCircle}>
                    {platform.info.assetUri ? (
                      <Image
                        source={{ uri: platform.info.assetUri }}
                        style={styles.icon}
                        contentFit="contain"
                      />
                    ) : (
                      <Feather
                        name="mail"
                        size={18}
                        color={Theme.palette.ink}
                      />
                    )}
                  </View>
                  <View style={styles.textGroup}>
                    <Text style={styles.platformLabel}>{platform.label}</Text>
                    <Text style={styles.platformDetail}>{platform.detail}</Text>
                    {platform.meta ? (
                      <Text style={styles.platformMeta}>{platform.meta}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.actionGroup}>
                  <Text
                    style={[
                      styles.statusText,
                      platform.connected ? styles.statusOn : styles.statusOff,
                    ]}
                  >
                    {platform.connected ? "Connected" : "Not connected"}
                  </Text>
                  <Pressable
                    onPress={() => toggleConnection(platform.id)}
                    disabled={busy[platform.id]}
                    style={[
                      styles.actionButton,
                      platform.connected
                        ? styles.disconnectButton
                        : styles.connectButton,
                      busy[platform.id] && styles.actionButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        platform.connected
                          ? styles.disconnectText
                          : styles.connectText,
                      ]}
                    >
                      {platform.connected
                        ? platform.id === "slack"
                          ? "Manage"
                          : "Disconnect"
                        : "Connect"}
                    </Text>
                  </Pressable>
                </View>
                {showTelegramSteps ? (
                  <View style={styles.telegramSteps}>
                    <View style={styles.telegramStep}>
                      <View
                        style={[
                          styles.telegramStepIndicator,
                          (telegramFlowActive || telegramStarted) &&
                            styles.telegramStepIndicatorActive,
                          telegramStarted &&
                            styles.telegramStepIndicatorComplete,
                        ]}
                      >
                        {telegramStarted ? (
                          <Feather name="check" size={14} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.telegramStepNumber}>1</Text>
                        )}
                      </View>
                      <View style={styles.telegramStepTextGroup}>
                        <Text style={styles.telegramStepTitle}>
                          Start the bot
                        </Text>
                        <Text style={styles.telegramStepDescription}>
                          Tap Connect to open Telegram and press Start inside
                          DueSoon Bot.
                        </Text>
                        {!telegramStarted ? (
                          <Pressable
                            onPress={() => toggleConnection("telegram")}
                            disabled={!canOpenTelegram || busy.telegram}
                            style={[
                              styles.telegramLink,
                              (!canOpenTelegram || busy.telegram) &&
                                styles.telegramLinkDisabled,
                            ]}
                          >
                            <Text style={styles.telegramLinkText}>
                              Open Telegram
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.telegramStep}>
                      <View
                        style={[
                          styles.telegramStepIndicator,
                          (telegramStarted || telegramBusinessConnected) &&
                            styles.telegramStepIndicatorActive,
                          telegramBusinessConnected &&
                            styles.telegramStepIndicatorComplete,
                        ]}
                      >
                        {telegramBusinessConnected ? (
                          <Feather name="check" size={14} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.telegramStepNumber}>2</Text>
                        )}
                      </View>
                      <View style={styles.telegramStepTextGroup}>
                        <Text style={styles.telegramStepTitle}>
                          Connect to Business
                        </Text>
                        <Text style={styles.telegramStepDescription}>
                          Add DueSoon under Telegram Business
                        </Text>
                        {showBusinessChecklist ? (
                          <View style={styles.telegramInstructionList}>
                            <View style={styles.telegramInstructionItem}>
                              <View style={styles.telegramInstructionBullet} />
                              <Text style={styles.telegramInstructionText}>
                                Open Telegram Settings → Telegram Business.
                              </Text>
                            </View>
                            <View style={styles.telegramInstructionItem}>
                              <View style={styles.telegramInstructionBullet} />
                              <Text style={styles.telegramInstructionText}>
                                Enter Chatbots, Enter Bot User Name
                                (duesoon_reminder_bot). Click Add.
                              </Text>
                            </View>
                            <View style={styles.telegramInstructionItem}>
                              <View style={styles.telegramInstructionBullet} />
                              <Text style={styles.telegramInstructionText}>
                                Make sure to exit the Chatbots page on Telegram
                                for Bot To Activate.
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {confirmDisconnect ? (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              Disconnect {confirmDisconnect.label}?
            </Text>
            <Text style={styles.confirmDetail}>
              We’ll stop sending reminders via {confirmDisconnect.label} until
              you connect it again.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.cancelConfirm]}
                onPress={() => setConfirmDisconnect(null)}
              >
                <Text style={styles.cancelConfirmText}>Keep it</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.dangerConfirm]}
                onPress={async () => {
                  const id = confirmDisconnect.id;
                  setConfirmDisconnect(null);
                  setBusy((prev) => ({ ...prev, [id]: true }));
                  try {
                    if (!session?.accessToken) {
                      throw new Error(
                        "You need to be signed in to manage connections.",
                      );
                    }
                    if (id === "gmail") {
                      await disconnectGmailAccount(session.accessToken);
                      await updateUserProfile({ channels: { gmail: false } });
                      setConnections((prev) => ({ ...prev, gmail: false }));
                      setGmailStatus({ connected: false });
                      await setCachedValue(GMAIL_STATUS_CACHE_KEY, {
                        connected: false,
                      });
                    } else if (id === "outlook") {
                      await disconnectOutlookAccount(session.accessToken);
                      await updateUserProfile({ channels: { outlook: false } });
                      setConnections((prev) => ({ ...prev, outlook: false }));
                      setOutlookStatus({ connected: false });
                      await setCachedValue(OUTLOOK_STATUS_CACHE_KEY, {
                        connected: false,
                      });
                    } else if (id === "telegram") {
                      await disconnectTelegram(session.accessToken);
                      await updateUserProfile({
                        channels: { telegram: false },
                      });
                      telegramChannelStateRef.current = false;
                      setConnections((prev) => ({ ...prev, telegram: false }));
                      setTelegramStatus({
                        has_started_bot: false,
                        has_business_connection: false,
                        connection: null,
                        chats: [],
                      });
                      await setCachedValue(TELEGRAM_STATUS_CACHE_KEY, {
                        has_started_bot: false,
                        has_business_connection: false,
                        connection: null,
                        chats: [],
                      });
                    } else {
                      await disconnectChannel(id, session.accessToken);
                      await updateUserProfile({ channels: { [id]: false } });
                      setConnections((prev) => ({ ...prev, [id]: false }));
                    }
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Unable to disconnect. Please try again.",
                    );
                  } finally {
                    setBusy((prev) => ({ ...prev, [id]: false }));
                  }
                }}
              >
                <Text style={styles.dangerConfirmText}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  confirmCard: {
    width: "100%",
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  confirmDetail: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  confirmButton: {
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelConfirm: {
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  cancelConfirmText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  dangerConfirm: {
    borderColor: "rgba(180, 35, 24, 0.4)",
    backgroundColor: "rgba(243, 174, 168, 0.3)",
  },
  dangerConfirmText: {
    color: "#B42318",
    fontWeight: "600",
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
  },
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  platformRow: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    gap: Theme.spacing.md,
  },
  connectedRow: {
    backgroundColor: "rgba(37, 47, 63, 0.02)",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  platformInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  icon: {
    width: 20,
    height: 20,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  platformLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  platformDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  platformMeta: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Theme.spacing.sm,
    flexWrap: "wrap",
    gap: Theme.spacing.sm,
  },
  detailsLink: {
    paddingHorizontal: 0,
  },
  detailsLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.accent,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusOn: {
    color: Theme.palette.ink,
  },
  statusOff: {
    color: Theme.palette.slate,
  },
  actionButton: {
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  connectButton: {
    borderColor: Theme.palette.ink,
    backgroundColor: Theme.palette.ink,
  },
  disconnectButton: {
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  connectText: {
    color: "#FFFFFF",
  },
  disconnectText: {
    color: Theme.palette.ink,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
  },
  telegramSteps: {
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
    gap: Theme.spacing.md,
  },
  telegramStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.spacing.md,
  },
  telegramStepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  telegramStepIndicatorActive: {
    borderColor: Theme.palette.ink,
  },
  telegramStepIndicatorComplete: {
    borderColor: Theme.palette.success,
    backgroundColor: Theme.palette.success,
  },
  telegramStepNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  telegramStepTextGroup: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  telegramStepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  telegramStepDescription: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  telegramLink: {
    paddingVertical: 2,
  },
  telegramLinkDisabled: {
    opacity: 0.5,
  },
  telegramLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.accent,
  },
  telegramInstructionList: {
    marginTop: Theme.spacing.xs,
    gap: Theme.spacing.xs,
  },
  telegramInstructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.spacing.xs,
  },
  telegramInstructionBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.palette.slate,
    marginTop: 7,
  },
  telegramInstructionText: {
    flex: 1,
    fontSize: 13,
    color: Theme.palette.slate,
  },
});
