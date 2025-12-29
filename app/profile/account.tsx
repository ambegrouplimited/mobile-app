import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ToggleGroup } from "@/components/toggle-group";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";

type ProfileDetail = {
  label: string;
  value: string;
  editable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
};

const ACCOUNT_CACHE_KEY = "cache.settings.account";

export default function AccountScreen() {
  const router = useRouter();
  const { user, updateUserProfile, refreshSession } = useAuth();
  const avatarUri = (user as { avatarUrl?: string } | undefined)?.avatarUrl;
  const initialProfile = useMemo(
    () => ({
      name: user?.name ?? "DueSoon Demo",
      type: normalizeTypeValue(user?.type ?? "freelancer"),
    }),
    [user?.name, user?.type],
  );
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const createdDate = useMemo(() => {
    if (!user?.created_at) return "Not available";
    const date = new Date(user.created_at);
    if (Number.isNaN(date.getTime())) return user.created_at;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [user?.created_at]);

  useEffect(() => {
    setProfile(initialProfile);
    setFormError(null);
    setIsEditing(false);
  }, [initialProfile]);

  useEffect(() => {
    if (user?.name || user?.type || user?.email) {
      setCachedValue(ACCOUNT_CACHE_KEY, {
        name: user?.name ?? "",
        type: user?.type ?? "freelancer",
        email: user?.email ?? "",
      });
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<{ name: string; type: string; email: string }>(ACCOUNT_CACHE_KEY);
      if (!cancelled && cached) {
        setProfile({
          name: cached.name || "DueSoon Demo",
          type: normalizeTypeValue(cached.type || "freelancer"),
        });
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.name, user?.type]);

  const profileDetails: ProfileDetail[] = [
    {
      label: "Full name",
      value: profile.name,
      editable: true,
      placeholder: "Enter your full name",
      onChange: (value: string) => setProfile((prev) => ({ ...prev, name: value })),
    },
    { label: "Joined", value: createdDate },
  ];

  const buildUpdates = () => {
    const updates: { name?: string; type?: string } = {};
    const trimmedName = profile.name.trim();
    const currentName = user?.name ?? "";
    if (trimmedName && trimmedName !== currentName) {
      updates.name = trimmedName;
    }
    const normalizedType = normalizeTypeValue(profile.type);
    const currentType = user?.type ?? "";
    if (normalizedType && normalizedType !== currentType) {
      updates.type = normalizedType;
    }
    return updates;
  };

  const handleSave = async () => {
    const updates = buildUpdates();
    if (!updates.name && !updates.type) {
      setFormError("No changes to save.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await updateUserProfile(updates);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsEditing(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(initialProfile);
    setIsEditing(false);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSession();
    } catch (error) {
      console.warn("Failed to refresh account data", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Theme.palette.ink} />
        }
      >
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>Back to settings</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Manage your profile details and contact information.</Text>
          <View style={styles.controlRow}>
            {isEditing ? (
              <>
                <Pressable style={styles.ghostButton} onPress={handleCancel} disabled={isSaving}>
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={styles.primaryButtonText}>{isSaving ? "Saving…" : "Save changes"}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.secondaryButton} onPress={() => setIsEditing(true)}>
                <Text style={styles.secondaryButtonText}>Edit profile</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <FontAwesome name="user" size={44} color={Theme.palette.slate} />
            )}
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? "demo@duesoon.app"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile info</Text>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {profileDetails.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {isEditing && item.editable ? (
                <TextInput
                  style={styles.input}
                  value={item.value}
                  onChangeText={(value) => item.onChange?.(value)}
                  placeholder={item.placeholder}
                  placeholderTextColor={Theme.palette.slateSoft}
                  keyboardType={item.keyboardType}
                  autoCapitalize={item.autoCapitalize ?? "sentences"}
                />
              ) : (
                <Text style={styles.rowValue}>{item.value}</Text>
              )}
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Account type</Text>
            {isEditing ? (
              <ToggleGroup
                value={profile.type}
                onChange={(value) => setProfile((prev) => ({ ...prev, type: value as "freelancer" | "small_business" }))}
                options={[
                  { label: "Freelancer", value: "freelancer" },
                  { label: "Business", value: "small_business" },
                ]}
              />
            ) : (
              <Text style={styles.rowValue}>{profile.type === "small_business" ? "Business" : "Freelancer"}</Text>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeTypeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
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
  },
  controlRow: {
    flexDirection: "row",
    gap: Theme.spacing.sm,
    flexWrap: "wrap",
    marginTop: Theme.spacing.sm,
  },
  profileCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Theme.spacing.xs,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  profileEmail: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 15,
    color: Theme.palette.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 8,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.palette.slate,
  },
  primaryButton: {
    backgroundColor: Theme.palette.ink,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
