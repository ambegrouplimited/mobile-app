import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getContactPlatformInfo } from "@/constants/contact-platforms";
import { Theme } from "@/constants/theme";
import { ReminderMessage, reminderDetails } from "@/data/mock-reminders";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchClientMessages } from "@/services/messages";
import type { ClientMessage } from "@/types/messages";

const CLIENT_MESSAGES_CACHE_KEY = (clientId: string) =>
  `cache.messages.client.${clientId}`;
const MESSAGES_LIMIT = 20;

export default function ReminderMessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    clientId?: string | string[];
    client?: string;
    amount?: string;
    status?: string;
    platform?: string;
    currency?: string;
  }>();
  const id = getParam(params.id);
  const reminder = id ? reminderDetails[id] : undefined;
  const clientId = getParam(params.clientId);
  const paramClient = getParam(params.client);
  const paramAmount = getParam(params.amount);
  const paramStatus = getParam(params.status);
  const paramPlatform = getParam(params.platform);
  const scrollRef = useRef<ScrollView>(null);
  const paramCurrency = getParam(params.currency);
  const headerClient = paramClient ?? reminder?.client ?? "Client";
  const headerAmount = paramAmount
    ? formatHeaderAmount(paramAmount, paramCurrency)
    : reminder?.amount;
  const headerStatus = paramStatus ?? reminder?.status;
  const platformSource = paramPlatform ?? reminder?.platform;

  const platformMeta = useMemo(() => {
    return getContactPlatformInfo(platformSource);
  }, [platformSource]);

  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<ReminderMessage[]>(reminder?.messages ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(reminder?.messages ?? []);
  }, [reminder]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<ReminderMessage[]>(
        CLIENT_MESSAGES_CACHE_KEY(clientId)
      );
      if (!cancelled && cached?.length) {
        setMessages(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !session?.accessToken) return;
    let cancelled = false;
    const loadMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const entries = await fetchClientMessages(clientId, session.accessToken, {
          limit: MESSAGES_LIMIT,
        });
        if (cancelled) return;
        const mapped = entries.map((entry, index) =>
          buildChatMessage(entry, index)
        );
        setMessages(mapped);
        await setCachedValue(CLIENT_MESSAGES_CACHE_KEY(clientId), mapped);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load recent messages right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [clientId, session?.accessToken]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = composerText.trim();
    if (!trimmed) {
      return;
    }
    const newMessage: ReminderMessage = {
      id: `local-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setComposerText("");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 0}
      >
        <View style={styles.content}>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Back to reminder</Text>
          </Pressable>

          {reminder || paramClient ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{headerClient}</Text>
                <Text style={styles.subtitle}>
                  {[headerAmount, headerStatus].filter(Boolean).join(" • ")}
                </Text>
                {platformMeta ? (
                  <View style={styles.platformBadge}>
                    {platformMeta.assetUri ? (
                      <Image
                        source={{ uri: platformMeta.assetUri }}
                        style={styles.platformIcon}
                        contentFit="contain"
                      />
                    ) : (
                      <Feather name="mail" size={14} color={Theme.palette.slate} />
                    )}
                    <Text style={styles.platformLabel}>{platformMeta.label}</Text>
                  </View>
                ) : null}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <ScrollView ref={scrollRef} contentContainerStyle={styles.chatArea}>
                {messages.length === 0 ? (
                  <View style={styles.emptyChat}>
                    <Feather name="message-circle" size={20} color={Theme.palette.slate} />
                    <Text style={styles.placeholderDetail}>
                      {loading ? "Loading conversation…" : "No conversation yet."}
                    </Text>
                  </View>
                ) : (
                  messages.map((message) => (
                    <View
                      key={message.id}
                      style={[
                        styles.messageRow,
                        message.sender === "user" ? styles.alignEnd : styles.alignStart,
                      ]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          message.sender === "user" ? styles.userBubble : styles.clientBubble,
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            message.sender === "user" ? styles.userText : styles.clientText,
                          ]}
                        >
                          {message.text}
                        </Text>
                      </View>
                      <Text style={styles.timestamp}>{formatTimestamp(message.timestamp)}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.composer}>
                <View style={styles.composerIcon}>
                  {platformMeta.assetUri ? (
                    <Image
                      source={{ uri: platformMeta.assetUri }}
                      style={styles.composerIconImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Feather name="mail" size={18} color={Theme.palette.slate} />
                  )}
                </View>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Write a reply"
                    placeholderTextColor={Theme.palette.slate}
                    value={composerText}
                    onChangeText={setComposerText}
                    multiline
                  />
                </View>
                <Pressable
                  style={[styles.sendButton, !composerText.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!composerText.trim()}
                >
                  <Feather name="send" size={16} color="#FFFFFF" />
                </Pressable>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.md,
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
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  platformIcon: {
    width: 16,
    height: 16,
  },
  platformLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  chatArea: {
    flexGrow: 1,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.md,
  },
  messageRow: {
    maxWidth: "90%",
  },
  alignEnd: {
    alignSelf: "flex-end",
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radii.lg,
  },
  userBubble: {
    backgroundColor: Theme.palette.ink,
    borderBottomRightRadius: Theme.radii.sm,
  },
  clientBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderBottomLeftRadius: Theme.radii.sm,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: "#FFFFFF",
  },
  clientText: {
    color: Theme.palette.ink,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.palette.slateSoft,
    alignSelf: "flex-end",
  },
  emptyChat: {
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.lg,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  composerIcon: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  composerIconImage: {
    width: 24,
    height: 24,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    flexGrow: 1,
    minHeight: 36,
    maxHeight: 100,
    color: Theme.palette.ink,
    textAlignVertical: "center",
    paddingVertical: 8,
  },
  sendButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.ink,
  },
  sendButtonDisabled: {
    backgroundColor: Theme.palette.border,
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
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildChatMessage(entry: ClientMessage, index: number): ReminderMessage {
  const sender: ReminderMessage["sender"] =
    entry.direction === "outgoing" ? "user" : "client";
  const text = formatMessageText(entry);
  const id =
    (entry.metadata && (entry.metadata.message_id as string)) ||
    (entry.metadata && (entry.metadata.id as string)) ||
    `${entry.channel}-${entry.sent_at}-${index}`;
  return {
    id,
    sender,
    text,
    timestamp: entry.sent_at ?? new Date().toISOString(),
  };
}

function formatMessageText(entry: ClientMessage) {
  return entry.preview ?? entry.body ?? "(No preview available)";
}

function getParam(value?: string | string[]) {
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
