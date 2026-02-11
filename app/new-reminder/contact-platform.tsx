import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import {
  CONTACT_PLATFORM_INFO,
  CONTACT_PLATFORM_OPTIONS,
  ContactPlatformId,
} from "@/constants/contact-platforms";
import { useAuth } from "@/providers/auth-provider";
import { useReminderDraftPersistor } from "@/hooks/use-reminder-draft-persistor";

export default function ContactPlatformScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const initialPlatform = (persistedParams.platform as ContactPlatformId) ?? "gmail";
  const [selected, setSelected] = useState<ContactPlatformId>(initialPlatform);
  const draftId = persistedParams.draftId ?? null;
  const baseParams = useMemo(() => {
    const next = { ...persistedParams };
    delete next.draftId;
    return next;
  }, [persistedParams]);
  const paramsForDraft = useMemo(() => {
    return {
      ...baseParams,
      platform: selected,
    };
  }, [baseParams, selected]);
  const metadata = useMemo(
    () => ({
      client_name: baseParams.client || "New reminder",
      amount_display: formatAmountDisplay(baseParams.amount, baseParams.currency),
      status: "Delivery channel",
      next_action: "Confirm delivery preferences.",
    }),
    [baseParams.amount, baseParams.client, baseParams.currency],
  );
  const handleReturnToReminders = () => {
    router.replace("/reminders");
  };
  const handleBack = () => {
    if (draftId) {
      router.push({
        pathname: "/(tabs)/new-reminder",
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
    lastStep: "contact-platform",
    lastPath: "/new-reminder/contact-platform",
    enabled: Boolean(session?.accessToken && draftId),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navRow}>
          <Pressable style={styles.backLink} onPress={handleBack}>
            <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
            <Text style={styles.backLabel}>Back to reminder draft</Text>
          </Pressable>
          {draftId ? (
            <Pressable style={styles.remindersLink} onPress={handleReturnToReminders}>
              <Feather name="home" size={18} color={Theme.palette.slate} />
              <Text style={styles.remindersLabel}>Reminders</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Pick a contact platform</Text>
          <Text style={styles.subtitle}>
            DueSoon will mirror your tone and send the next reminder via the channel you pick here.
          </Text>
        </View>

        <View style={styles.platformGrid}>
          {CONTACT_PLATFORM_OPTIONS.map((platform) => {
            const active = platform.id === selected;
            const comingSoon = platform.id === "slack";
            return (
              <Pressable
                key={platform.id}
                onPress={() => setSelected(platform.id)}
                style={[styles.platformCard, active && styles.platformCardActive]}
              >
                <View style={styles.platformRow}>
                  <View style={styles.logoWrap}>
                    <Image
                      source={{ uri: CONTACT_PLATFORM_INFO[platform.id].assetUri }}
                      style={styles.logo}
                      contentFit="contain"
                    />
                  </View>
                  <View style={styles.platformText}>
                    <View style={styles.platformLabelRow}>
                      <Text style={styles.platformLabel}>{platform.label}</Text>
                      {comingSoon ? (
                        <View style={styles.platformBadge}>
                          <Text style={styles.platformBadgeText}>Coming soon</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.platformDetail}>{platform.detail}</Text>
                  </View>
                </View>
                {active ? (
                  <View style={styles.selectedBadge}>
                    <Feather name="check" size={14} color="#FFFFFF" />
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            selected === "slack" && styles.primaryButtonDisabled,
          ]}
          disabled={selected === "slack"}
          onPress={async () => {
            if (selected === "slack") {
              return;
            }
            await Haptics.selectionAsync();
            const savedDraftId = await ensureDraftSaved();
            const nextParams = {
              ...baseParams,
              platform: selected,
              ...(savedDraftId ? { draftId: savedDraftId } : {}),
            };
            router.push({
              pathname: "/new-reminder/send-options",
              params: nextParams,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>
            {selected === "slack"
              ? "Slack coming soon"
              : `Continue with ${formatLabel(selected)}`}
          </Text>
        </Pressable>
        {selected === "slack" ? (
          <Text style={styles.comingSoonHint}>
            Slack reminders are coming soon. Pick another channel for now.
          </Text>
        ) : null}
      </ScrollView>
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

function formatAmountDisplay(amount?: string, currency?: string) {
  if (!amount) return null;
  if (/[A-Za-z$€£¥₹₦₽₱₴₭₮₩]/.test(amount)) {
    return amount;
  }
  return currency ? `${currency.toUpperCase()} ${amount}` : amount;
}

function formatLabel(id: ContactPlatformId) {
  return CONTACT_PLATFORM_OPTIONS.find((platform) => platform.id === id)?.label ?? "platform";
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
  platformGrid: {
    gap: Theme.spacing.md,
  },
  platformCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  platformCardActive: {
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.08)",
  },
  platformRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
    alignItems: "center",
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 30,
    height: 30,
  },
  platformText: {
    flex: 1,
    gap: 2,
  },
  platformLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    flexWrap: "wrap",
  },
  platformLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  platformBadge: {
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: Theme.radii.sm,
    backgroundColor: Theme.palette.border,
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  platformDetail: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  selectedText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    backgroundColor: Theme.palette.border,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  comingSoonHint: {
    fontSize: 13,
    color: Theme.palette.slate,
    textAlign: "center",
  },
});
