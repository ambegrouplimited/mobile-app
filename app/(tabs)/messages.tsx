import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getContactPlatformInfo } from "@/constants/contact-platforms";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import { fetchConversationSummaries } from "@/services/messages";
import type { ConversationSummary } from "@/types/messages";

const CONVERSATION_CACHE_KEY = "cache.messages.conversations";

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<ConversationSummary[]>(
        CONVERSATION_CACHE_KEY
      );
      if (!cancelled && cached?.length) {
        setConversations(cached);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadConversations = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (!session?.accessToken) {
        setConversations([]);
        setError("Sign in to review your messages.");
        return;
      }
      const showSpinner = options?.showSpinner ?? true;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetchConversationSummaries(session.accessToken, {
          limit: 25,
        });
        setConversations(response);
        await setCachedValue(CONVERSATION_CACHE_KEY, response);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load conversations right now."
        );
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [session?.accessToken]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations({ showSpinner: false });
    setRefreshing(false);
  }, [loadConversations]);

  const handleOpenConversation = useCallback(
    (conversation: ConversationSummary) => {
      router.push({
        pathname: `/messages/${conversation.client_id}`,
        params: {
          clientName: conversation.client_name,
          contactLabel: conversation.contact_label,
          channel: conversation.channel,
          contactMethodId: conversation.contact_method_id,
        },
      });
    },
    [router]
  );

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
        <Text style={styles.pageTitle}>Messages</Text>
        <Text style={styles.pageSubtitle}>
          Latest messages across all channels.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.list}>
          {loading && !conversations.length ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={Theme.palette.slate} />
              <Text style={styles.loadingLabel}>Loading conversations…</Text>
            </View>
          ) : conversations.length === 0 ? (
            <Text style={styles.emptyState}>No messages just yet.</Text>
          ) : (
            conversations.map((conversation) => (
              <ConversationRow
                key={`${conversation.client_id}-${conversation.contact_method_id}`}
                conversation={conversation}
                onPress={handleOpenConversation}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationSummary;
  onPress: (item: ConversationSummary) => void;
}) {
  const platformMeta = useMemo(
    () => getContactPlatformInfo(conversation.channel),
    [conversation.channel]
  );
  const lastMessage = conversation.last_message;
  const directionLabel =
    lastMessage.direction === "outgoing" ? "You" : conversation.client_name;
  const timestamp = formatTimestamp(lastMessage.sent_at);
  return (
    <Pressable
      style={styles.conversationCard}
      onPress={() => onPress(conversation)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{conversation.client_name}</Text>
        <Text style={styles.cardCount}>
          {conversation.total_messages} message
          {conversation.total_messages === 1 ? "" : "s"}
        </Text>
      </View>
      <Text style={styles.cardContact}>{conversation.contact_label}</Text>
      <View style={styles.lastMessageRow}>
        <Text style={styles.lastMessageMeta}>
          {directionLabel} · {timestamp}
        </Text>
        {platformMeta ? (
          <View style={styles.platformTag}>
            {platformMeta.assetUri ? (
              <Image
                source={{ uri: platformMeta.assetUri }}
                style={styles.platformIcon}
                contentFit="contain"
              />
            ) : (
              <Feather name="mail" size={12} color={Theme.palette.slate} />
            )}
            <Text style={styles.platformLabel}>{platformMeta.label}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.lastMessageSubject}>
        {lastMessage.subject ?? "No subject"}
      </Text>
      <Text style={styles.lastMessagePreview}>
        {truncatePreview(lastMessage.preview)}
      </Text>
    </Pressable>
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
    gap: Theme.spacing.md,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  pageSubtitle: {
    fontSize: 15,
    color: Theme.palette.slate,
  },
  list: {
    gap: Theme.spacing.md,
  },
  errorText: {
    color: Theme.palette.accent,
  },
  loadingState: {
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.lg,
  },
  loadingLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  emptyState: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  conversationCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  cardCount: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  cardContact: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  lastMessageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessageMeta: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  platformTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
  platformIcon: {
    width: 14,
    height: 14,
  },
  platformLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    fontWeight: "500",
  },
  lastMessageSubject: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  lastMessagePreview: {
    fontSize: 13,
    color: Theme.palette.slate,
    lineHeight: 18,
  },
});

function formatTimestamp(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncatePreview(value?: string | null, max = 20) {
  if (!value) {
    return "No preview available.";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}
