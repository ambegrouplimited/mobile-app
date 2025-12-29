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

export default function ReminderMessagesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reminder = id ? reminderDetails[id] : undefined;
  const scrollRef = useRef<ScrollView>(null);

  const platformMeta = useMemo(() => {
    return getContactPlatformInfo(reminder?.platform);
  }, [reminder?.platform]);

  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<ReminderMessage[]>(reminder?.messages ?? []);

  useEffect(() => {
    setMessages(reminder?.messages ?? []);
  }, [reminder]);

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

          {reminder ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{reminder.client}</Text>
                <Text style={styles.subtitle}>{reminder.amount} • {reminder.status}</Text>
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

              <ScrollView ref={scrollRef} contentContainerStyle={styles.chatArea}>
                {messages.map((message) => (
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
                ))}
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
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
