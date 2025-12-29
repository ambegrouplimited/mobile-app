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

export default function ContactPlatformScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<Record<string, string>>();
  const persistedParams = useMemo(() => normalizeParams(rawParams), [rawParams]);
  const initialPlatform = (persistedParams.platform as ContactPlatformId) ?? "gmail";
  const [selected, setSelected] = useState<ContactPlatformId>(initialPlatform);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to reminder draft</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Pick a contact platform</Text>
          <Text style={styles.subtitle}>
            DueSoon will mirror your tone and send the next reminder via the channel you pick here.
          </Text>
        </View>

        <View style={styles.platformGrid}>
          {CONTACT_PLATFORM_OPTIONS.map((platform) => {
            const active = platform.id === selected;
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
                    <Text style={styles.platformLabel}>{platform.label}</Text>
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
          style={styles.primaryButton}
          onPress={async () => {
            await Haptics.selectionAsync();
            router.push({
              pathname: "/new-reminder/send-options",
              params: { ...persistedParams, platform: selected },
            });
          }}
        >
          <Text style={styles.primaryButtonText}>Continue with {formatLabel(selected)}</Text>
        </Pressable>
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
  platformLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
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
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
