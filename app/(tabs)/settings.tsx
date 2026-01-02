import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

const settingsItems = [
  {
    icon: "user",
    label: "Account",
    detail: "Profile, email aliases",
    route: "/profile/account",
  },
  {
    icon: "bell",
    label: "Notifications",
    detail: "Reminder cadence & alerts",
    route: "/settings/notifications",
  },
  {
    icon: "dollar-sign",
    label: "Currency",
    detail: "Default currency",
    route: "/settings/currency",
  },
  {
    icon: "clock",
    label: "Timezone",
    detail: "Reminder timezone",
    route: "/settings/timezone",
  },
  {
    icon: "credit-card",
    label: "Payment methods",
    detail: "Bank, Stripe, crypto",
    route: "/settings/payment-methods",
  },
  {
    icon: "message-square",
    label: "Messaging connections",
    detail: "Gmail, WhatsApp, Slack",
    route: "/settings/messaging-connections",
  },
  {
    icon: "shield",
    label: "Security",
    detail: "Two-factor, devices",
    route: "/settings/security",
  },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const displayName = user?.name ?? "DueSoon Demo";
  const avatarUri = (user as { avatarUrl?: string } | undefined)?.avatarUrl;
  const router = useRouter();
  const currencyLabel = (user?.default_currency ?? "USD").toUpperCase();
  const timezoneLabel = user?.default_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView bounces={true} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.container}>
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <FontAwesome
                  name="user"
                  size={44}
                  color={Theme.palette.slate}
                />
              )}
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
          </View>

          <View style={styles.list}>
            {settingsItems.map((item, index) => (
              <Pressable
                key={item.label}
                style={[
                  styles.row,
                  index === settingsItems.length - 1 && styles.rowLast,
                ]}
                onPress={() => {
                  if (item.route) {
                    router.push(item.route);
                  }
                }}
              >
                <View style={styles.iconWrap}>
                  <Feather
                    name={item.icon as keyof typeof Feather.glyphMap}
                    size={18}
                    color={Theme.palette.slate}
                  />
                </View>
                <View style={styles.textBlock}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.detail}>
                    {item.label === "Currency"
                      ? currencyLabel
                      : item.label === "Timezone"
                        ? timezoneLabel
                        : item.detail}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={Theme.palette.slateSoft}
                />
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.logoutButton}
            onPress={() => setConfirmVisible(true)}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log out</Text>
            <Text style={styles.modalSubtitle}>
              You’ll need to sign back in to manage reminders and clients.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButtonMuted}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalButtonMutedText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButton}
                onPress={async () => {
                  setConfirmVisible(false);
                  await logout();
                }}
              >
                <Text style={styles.modalButtonText}>Log out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxxl,
  },
  profileCard: {
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.sm,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  list: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    gap: Theme.spacing.md,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    color: Theme.palette.ink,
    fontWeight: "500",
  },
  detail: {
    fontSize: 13,
    color: Theme.palette.slateSoft,
  },
  logoutButton: {
    marginTop: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: "rgba(180, 35, 24, 0.2)",
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    backgroundColor: "rgba(243, 174, 168, 0.2)",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#B42318",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 23, 0.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: Theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
  },
  modalButtonMuted: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radii.md,
  },
  modalButtonMutedText: {
    fontSize: 14,
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  modalButton: {
    backgroundColor: Theme.palette.ink,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radii.md,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
