import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { subscribeToMessageEvents } from "@/lib/message-stream";
import { openSubscriptionUpsell } from "@/lib/subscription-upsell";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchClientMessages,
  fetchQuickReplies,
  sendClientMessage,
} from "@/services/messages";
import type { ClientMessage } from "@/types/messages";

const CLIENT_MESSAGES_CACHE_KEY = (clientId: string) =>
  `cache.messages.client.${clientId}`;
const MESSAGES_LIMIT = 30;

type ChatMessage = {
  id: string;
  sender: "user" | "client";
  text: string;
  timestamp: string;
  status?: "pending" | "sent" | "failed";
};

export default function ClientConversationScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const params = useLocalSearchParams<{
    clientId: string;
    clientName?: string;
    channel?: string;
    contactMethodId?: string;
  }>();
  const clientId = getParam(params.clientId);
  const clientName = getParam(params.clientName) ?? "Client conversation";
  const displayName = useMemo(() => truncateName(clientName, 10), [clientName]);
  const channel = getParam(params.channel);
  const contactMethodId = getParam(params.contactMethodId);
  const platformMeta = useMemo(
    () => getContactPlatformInfo(channel),
    [channel]
  );
  const canSend = Boolean(contactMethodId && clientId && session?.accessToken);
  const scrollRef = useRef<ScrollView>(null);
  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [quickRepliesError, setQuickRepliesError] = useState<string | null>(
    null
  );
  const [quickRepliesCollapsed, setQuickRepliesCollapsed] = useState(false);
  const composerHasTextRef = useRef(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<ChatMessage[]>(
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
    const hasText = composerText.trim().length > 0;
    if (hasText && !composerHasTextRef.current) {
      setQuickRepliesCollapsed(true);
    } else if (!hasText && composerHasTextRef.current) {
      setQuickRepliesCollapsed(false);
    }
    composerHasTextRef.current = hasText;
  }, [composerText]);

  const loadMessages = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (!clientId || !session?.accessToken) return;
      const showSpinner = options?.showSpinner ?? true;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const entries = await fetchClientMessages(
          clientId,
          session.accessToken,
          { limit: MESSAGES_LIMIT }
        );
        const mapped = entries.map((entry, index) =>
          buildChatMessage(entry, index)
        );
        setMessages((prev) => mergeMessages(mapped, prev));
        await setCachedValue(CLIENT_MESSAGES_CACHE_KEY(clientId), mapped);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load recent messages right now."
        );
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [clientId, session?.accessToken]
  );

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const messagingAllowed = Boolean(
    user?.subscription?.is_active || user?.subscription?.is_trialing
  );

  const loadQuickReplies = useCallback(async () => {
    if (
      !clientId ||
      !contactMethodId ||
      !session?.accessToken ||
      !messagingAllowed
    ) {
      setQuickReplies([]);
      setQuickRepliesError(null);
      return;
    }
    setQuickRepliesLoading(true);
    setQuickRepliesError(null);
    try {
      const response = await fetchQuickReplies(clientId, session.accessToken, {
        contactMethodId,
      });
      setQuickReplies(response.suggestions.map((item) => item.text));
    } catch (err) {
      setQuickRepliesError(
        err instanceof Error
          ? err.message
          : "Unable to load quick replies right now."
      );
    } finally {
      setQuickRepliesLoading(false);
    }
  }, [clientId, contactMethodId, messagingAllowed, session?.accessToken]);

  useEffect(() => {
    void loadQuickReplies();
  }, [loadQuickReplies]);

  useEffect(() => {
    if (
      !session?.accessToken ||
      !clientId ||
      !contactMethodId ||
      !messagingAllowed
    ) {
      return;
    }
    const conversationKey = getConversationKey(clientId, contactMethodId);
    const unsubscribe = subscribeToMessageEvents(
      session.accessToken,
      (event) => {
        if (event.conversation_id !== conversationKey || !event.message) {
          return;
        }
        const incoming = buildChatMessageFromEntry(event.message, "stream");
        setMessages((prev) => upsertMessage(prev, incoming));
        if (event.message.direction === "incoming") {
          void loadQuickReplies();
        }
      }
    );
    return () => {
      unsubscribe();
    };
  }, [session?.accessToken, clientId, contactMethodId, messagingAllowed, loadQuickReplies]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessageBody = useCallback(
    async (text: string, options?: { skipComposerClear?: boolean }) => {
      const trimmed = text.trim();
      if (
        !trimmed ||
        !clientId ||
        !contactMethodId ||
        !session?.accessToken
      ) {
        return;
      }
      if (!messagingAllowed) {
        openSubscriptionUpsell("Upgrade to DueSoon Pro to send direct messages.");
        return;
      }
      setSendError(null);
      setSending(true);
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        sender: "user",
        text: trimmed,
        timestamp: new Date().toISOString(),
        status: "pending",
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      if (!options?.skipComposerClear) {
        setComposerText("");
      }
      try {
        await sendClientMessage(
          {
            client_id: clientId,
            contact_method_id: contactMethodId,
            body: trimmed,
          },
          session.accessToken
        );
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? { ...message, status: "sent" } : message
          )
        );
        void loadQuickReplies();
      } catch (err) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? { ...message, status: "failed" } : message
          )
        );
        setSendError(
          err instanceof Error
            ? err.message
            : "Unable to send this message right now."
        );
      } finally {
        setSending(false);
      }
    },
    [clientId, contactMethodId, loadQuickReplies, messagingAllowed, session?.accessToken]
  );

  const handleSend = useCallback(() => {
    const trimmed = composerText.trim();
    if (!trimmed) return;
    void sendMessageBody(trimmed);
  }, [composerText, sendMessageBody]);

  const handleQuickReply = useCallback((text: string) => {
    if (!text) return;
    setComposerText((prev) => {
      if (!prev?.trim()) {
        return text;
      }
      return `${prev.trimEnd()} ${text}`;
    });
  }, []);
  const canToggleQuickReplies =
    quickReplies.length > 0 ||
    quickRepliesLoading ||
    Boolean(quickRepliesError);

  if (!messagingAllowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.lockedContainer}>
        <View style={styles.lockedCard}>
          <Feather name="lock" size={28} color={Theme.palette.slate} />
          <Text style={styles.lockedTitle}>Messaging is locked</Text>
          <Text style={styles.lockedSubtitle}>
            Join DueSoon Pro to reply to client conversations and keep
            reminders in sync.
          </Text>
          <Pressable
            style={styles.lockedButton}
            onPress={() =>
              openSubscriptionUpsell(
                  "Messaging is available on the Pro plan. Upgrade to reply to clients directly.",
                  { headline: "Unlock messaging" }
              )
            }
          >
              <Text style={styles.lockedButtonText}>See plan details</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <View style={styles.headerSide}>
              <Pressable style={styles.backLink} onPress={() => router.back()}>
                <Feather
                  name="arrow-left"
                  size={24}
                  color={Theme.palette.ink}
                />
                <Text style={styles.backLabel}>Messages</Text>
              </Pressable>
            </View>

            <View style={styles.headerCenter}>
              <Text style={styles.title} numberOfLines={1}>
                {displayName}
              </Text>
            </View>

            <View style={styles.headerSideRight}>
              {platformMeta ? (
                <View
                  style={styles.platformBadge}
                  accessibilityRole="image"
                  accessibilityLabel={`${platformMeta.label} channel`}
                >
                  {platformMeta.assetUri ? (
                    <Image
                      source={{ uri: platformMeta.assetUri }}
                      style={styles.platformIcon}
                      contentFit="contain"
                    />
                  ) : (
                    <Feather
                      name="mail"
                      size={16}
                      color={Theme.palette.slate}
                    />
                  )}
                </View>
              ) : (
                <View style={styles.platformPlaceholder} />
              )}
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!canSend ? (
            <Text style={styles.errorText}>
              This conversation cannot send messages right now.
            </Text>
          ) : null}

          <ScrollView ref={scrollRef} contentContainerStyle={styles.chatArea}>
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Feather
                  name="message-circle"
                  size={20}
                  color={Theme.palette.slate}
                />
                <Text style={styles.placeholderDetail}>
                  {loading ? "Loading conversation…" : "No conversation yet."}
                </Text>
              </View>
            ) : (
              messages.map((message, index) => (
                <View
                  key={getMessageRenderKey(message, index)}
                  style={[
                    styles.messageRow,
                    message.sender === "user"
                      ? styles.alignEnd
                      : styles.alignStart,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.sender === "user"
                        ? styles.userBubble
                        : styles.clientBubble,
                    ]}
                  >
                    <ExpandableText
                      text={message.text}
                      color={
                        message.sender === "user"
                          ? styles.userText.color
                          : styles.clientText.color
                      }
                    />
                  </View>
                  <Text style={styles.timestamp}>
                    {message.status === "pending"
                      ? "Sending…"
                      : message.status === "failed"
                      ? "Failed to send"
                      : formatTimestamp(message.timestamp)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {canSend ? (
            <View
              style={[
                styles.quickRepliesContainer,
                quickRepliesCollapsed && styles.quickRepliesCollapsed,
              ]}
            >
              <View style={styles.quickRepliesHeader}>
                <Text style={styles.quickRepliesLabel}>Quick replies</Text>
                <View style={styles.quickRepliesHeaderActions}>
                  {quickRepliesLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={Theme.palette.slate}
                    />
                  ) : null}
                  {canToggleQuickReplies ? (
                    <Pressable
                      style={styles.quickRepliesToggle}
                      onPress={() => setQuickRepliesCollapsed((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        quickRepliesCollapsed
                          ? "Show quick replies"
                          : "Hide quick replies"
                      }
                    >
                      <Feather
                        name={
                          quickRepliesCollapsed ? "chevron-down" : "chevron-up"
                        }
                        size={16}
                        color={Theme.palette.ink}
                      />
                      <Text style={styles.quickRepliesToggleText}>
                        {quickRepliesCollapsed ? "Show" : "Hide"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {!quickRepliesCollapsed ? (
                <>
                  {quickRepliesError ? (
                    <Text style={styles.quickRepliesErrorText}>
                      {quickRepliesError}
                    </Text>
                  ) : null}
                  {!quickRepliesLoading && quickReplies.length === 0 ? (
                    <Text style={styles.quickRepliesPlaceholder}>
                      AI suggestions will appear when the client replies.
                    </Text>
                  ) : null}
                  {quickReplies.length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickRepliesRow}
                    >
                      {quickReplies.map((reply) => (
                        <Pressable
                          key={reply}
                          style={[
                            styles.quickReplyChip,
                            sending && styles.quickReplyChipDisabled,
                          ]}
                          onPress={() => handleQuickReply(reply)}
                          disabled={sending}
                        >
                          <Text style={styles.quickReplyText}>{reply}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.composer}>
            <View style={styles.composerIcon}>
              {platformMeta?.assetUri ? (
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
              style={[
                styles.sendButton,
                (!composerText.trim() || sending || !canSend) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!composerText.trim() || sending || !canSend}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={16} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
          {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
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
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: Theme.spacing.xs,
  },
  headerSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerSideRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerCenter: {
    flex: 2,
    alignItems: "center",
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
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: Theme.palette.ink,
    textAlign: "center",
  },
  platformBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  platformPlaceholder: {
    width: 36,
    height: 36,
  },
  platformIcon: {
    width: 20,
    height: 20,
  },
  chatArea: {
    flexGrow: 1,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.md,
  },
  quickRepliesContainer: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    backgroundColor: "#FFFFFF",
    gap: Theme.spacing.sm,
  },
  quickRepliesCollapsed: {
    paddingBottom: Theme.spacing.sm,
  },
  quickRepliesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickRepliesHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  quickRepliesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  quickRepliesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: Theme.radii.sm,
  },
  quickRepliesToggleText: {
    fontSize: 13,
    color: Theme.palette.ink,
  },
  quickRepliesRow: {
    gap: Theme.spacing.sm,
  },
  quickReplyChip: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  quickReplyChipDisabled: {
    opacity: 0.6,
  },
  quickReplyText: {
    color: Theme.palette.ink,
    fontSize: 14,
  },
  quickRepliesPlaceholder: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  quickRepliesErrorText: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  messageRow: {
    gap: 4,
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  alignStart: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: Theme.radii.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  userBubble: {
    backgroundColor: Theme.palette.ink,
  },
  clientBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: "#FFFFFF",
  },
  clientText: {
    color: Theme.palette.ink,
  },
  timestamp: {
    fontSize: 11,
    color: Theme.palette.slateSoft,
  },
  expandLink: {
    color: Theme.palette.slate,
    fontWeight: "600",
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
  emptyChat: {
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.lg,
  },
  placeholderDetail: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  errorText: {
    fontSize: 13,
    color: Theme.palette.accent,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  lockedCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
    padding: Theme.spacing.xl,
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.palette.ink,
  },
  lockedSubtitle: {
    fontSize: 15,
    color: Theme.palette.slate,
    textAlign: "center",
  },
  lockedButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
  },
  lockedButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
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

function buildChatMessage(entry: ClientMessage, index: number): ChatMessage {
  return buildChatMessageFromEntry(entry, String(index));
}

function buildChatMessageFromEntry(
  entry: ClientMessage,
  suffix: string
): ChatMessage {
  const sender: ChatMessage["sender"] =
    entry.direction === "outgoing" ? "user" : "client";
  const text = entry.preview ?? entry.body ?? "(No preview available)";
  const id =
    (entry.metadata && (entry.metadata.message_id as string)) ||
    (entry.metadata && (entry.metadata.id as string)) ||
    `${entry.channel}-${entry.sent_at}-${suffix}`;
  return {
    id,
    sender,
    text,
    timestamp: entry.sent_at ?? new Date().toISOString(),
  };
}

function mergeMessages(fetched: ChatMessage[], previous: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of fetched) {
    byId.set(message.id, message);
  }
  for (const message of previous) {
    const isLocalUserMessage =
      message.sender === "user" &&
      typeof message.id === "string" &&
      message.id.startsWith("temp-");
    const shouldPersistLocal =
      isLocalUserMessage &&
      (message.status === "pending" || message.status === "failed");
    if (shouldPersistLocal && !byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return sortMessages([...byId.values()]);
}

function upsertMessage(
  previous: ChatMessage[],
  incoming: ChatMessage
): ChatMessage[] {
  if (incoming.sender === "user") {
    const matchIndex = previous.findIndex((message) =>
      matchesLocalMessage(message, incoming)
    );
    if (matchIndex >= 0) {
      const copy = [...previous];
      copy[matchIndex] = {
        ...incoming,
        status: "sent",
        id: incoming.id || copy[matchIndex].id,
      };
      return sortMessages(copy);
    }
  }
  const existingIndex = previous.findIndex(
    (message) => message.id === incoming.id
  );
  if (existingIndex >= 0) {
    const copy = [...previous];
    copy[existingIndex] = {
      ...copy[existingIndex],
      ...incoming,
      status: incoming.status ?? copy[existingIndex].status,
    };
    return copy;
  }
  return sortMessages([...previous, incoming]);
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function matchesLocalMessage(
  localMessage: ChatMessage,
  incoming: ChatMessage
): boolean {
  if (localMessage.sender !== "user") return false;
  if (!localMessage.status || localMessage.status === "failed") return false;
  return (
    normalizeMessageText(localMessage.text) ===
    normalizeMessageText(incoming.text)
  );
}

function normalizeMessageText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function truncateName(value: string, limit: number) {
  if (!value || value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}-`;
}

function getParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getConversationKey(
  clientId?: string | null,
  contactMethodId?: string | null
) {
  return `${clientId ?? "unknown"}:${contactMethodId ?? "default"}`;
}

function getMessageRenderKey(message: ChatMessage, index: number) {
  const keyParts = [
    message.id,
    message.timestamp,
    message.sender,
    index.toString(),
  ].filter(Boolean);
  return keyParts.join(":");
}

function ExpandableText({ text, color }: { text: string; color?: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 100;
  const shouldTruncate = text.length > limit;
  const displayText =
    !expanded && shouldTruncate ? `${text.slice(0, limit)}…` : text;
  return (
    <Text style={[styles.messageText, color ? { color } : null]}>
      {displayText}
      {shouldTruncate ? (
        <Text
          style={styles.expandLink}
          onPress={() => setExpanded((prev) => !prev)}
        >
          {expanded ? " Read less" : " Read more"}
        </Text>
      ) : null}
    </Text>
  );
}
