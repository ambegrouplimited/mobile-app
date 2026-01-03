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
import { useAuth } from "@/providers/auth-provider";
import { fetchClientMessages, sendClientMessage } from "@/services/messages";
import { subscribeToMessageEvents } from "@/lib/message-stream";
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
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    clientId: string;
    clientName?: string;
    contactLabel?: string;
    channel?: string;
    contactMethodId?: string;
  }>();
  const clientId = getParam(params.clientId);
  const clientName = getParam(params.clientName) ?? "Client conversation";
  const contactLabel = getParam(params.contactLabel);
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

  useEffect(() => {
    if (!session?.accessToken || !clientId || !contactMethodId) {
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
      }
    );
    return () => {
      unsubscribe();
    };
  }, [session?.accessToken, clientId, contactMethodId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = composerText.trim();
    if (!trimmed || !clientId || !contactMethodId || !session?.accessToken) {
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
    setComposerText("");
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
      await loadMessages({ showSpinner: false });
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
  }, [
    clientId,
    contactMethodId,
    composerText,
    loadMessages,
    session?.accessToken,
  ]);

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
            <Text style={styles.backLabel}>Messages</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>{clientName}</Text>
            {contactLabel ? (
              <Text style={styles.subtitle}>{contactLabel}</Text>
            ) : null}
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
              messages.map((message) => (
                <View
                  key={message.id}
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
  for (const message of previous) {
    byId.set(message.id, message);
  }
  for (const message of fetched) {
    byId.set(message.id, message);
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
  return normalizeMessageText(localMessage.text) === normalizeMessageText(incoming.text);
}

function normalizeMessageText(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

function ExpandableText({
  text,
  color,
}: {
  text: string;
  color?: string;
}) {
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
