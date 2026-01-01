import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QrCode } from "@/components/ui/qr-code";
import { Theme } from "@/constants/theme";
import { getCachedValue, setCachedValue } from "@/lib/cache";
import { useAuth } from "@/providers/auth-provider";
import Clipboard from "@react-native-clipboard/clipboard";
import { formatRelativeTime } from "@/lib/date";
import { fetchSessions, revokeSession } from "@/services/security";
import type { SessionInfo } from "@/types/security";

import {
  beginTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
  fetchTwoFactorStatus,
  requestTwoFactorEmailOtp,
  TwoFactorSetupResponse,
  TwoFactorStatus,
} from "@/services/two-factor";

const TWO_FACTOR_CACHE_KEY = "cache.security.twoFactorStatus";
const SESSIONS_CACHE_KEY = "cache.security.sessions";

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [setupInfo, setSetupInfo] = useState<TwoFactorSetupResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [confirmingAuth, setConfirmingAuth] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);
  const [enableModalVisible, setEnableModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [enableStep, setEnableStep] = useState<"email" | "auth">("email");
  const [enableError, setEnableError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogOutSession = async (id: string) => {
    if (!session?.accessToken) {
      setSessionsError("Sign in again to manage sessions.");
      return;
    }
    await Haptics.selectionAsync();
    try {
      await revokeSession(id, session.accessToken);
      setSessions((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setSessionsError(
        err instanceof Error
          ? err.message
          : "Unable to sign out this session right now."
      );
    }
  };

  const loadStatus = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    try {
      setStatusLoading(true);
      const status = await fetchTwoFactorStatus(session.accessToken);
      setTwoFactorStatus(status);
      await setCachedValue(TWO_FACTOR_CACHE_KEY, status);
      if (!status.pending_setup) {
        setSetupInfo(null);
        setEmailOtp("");
        setAuthCode("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load two-factor status."
      );
    } finally {
      setStatusLoading(false);
    }
  }, [session?.accessToken]);

  const loadSessions = useCallback(async () => {
    if (!session?.accessToken) {
      setSessions([]);
      setSessionsError("Sign in to see active sessions.");
      return;
    }
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await fetchSessions(session.accessToken);
      setSessions(response);
      await setCachedValue(SESSIONS_CACHE_KEY, response);
    } catch (err) {
      setSessionsError(
        err instanceof Error ? err.message : "Unable to load sessions."
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cached = await getCachedValue<TwoFactorStatus>(
        TWO_FACTOR_CACHE_KEY
      );
      if (!cancelled && cached) {
        setTwoFactorStatus(cached);
      }
      const cachedSessions = await getCachedValue<SessionInfo[]>(
        SESSIONS_CACHE_KEY
      );
      if (!cancelled && cachedSessions) {
        setSessions(cachedSessions);
      }
      if (!cancelled) {
        await Promise.all([loadStatus(), loadSessions()]);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [loadSessions, loadStatus]);

  const handleSendEmailOtp = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }
    setEnableError(null);
    setSendingEmail(true);
    try {
      await requestTwoFactorEmailOtp(session.accessToken);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to send the email code.";
      setEnableError(message);
      setError(message);
      throw err;
    } finally {
      setSendingEmail(false);
    }
  }, [session?.accessToken]);

  const resendEmailOtp = useCallback(async () => {
    if (sendingEmail) {
      return;
    }
    try {
      await handleSendEmailOtp();
    } catch {
      // handled via enableError
    }
  }, [handleSendEmailOtp, sendingEmail]);

  const handleVerifyEmailOtp = useCallback(async () => {
    if (!session?.accessToken || emailOtp.trim().length < 6) {
      return;
    }
    setVerifyingEmailOtp(true);
    setEnableError(null);
    try {
      const info = await beginTwoFactorSetup(
        { emailOtp: emailOtp.trim() },
        session.accessToken
      );
      setSetupInfo(info);
      setTwoFactorStatus({ enabled: false, pending_setup: true });
      setEnableStep("auth");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to verify the email code.";
      setEnableError(message);
      setError(message);
    } finally {
      setVerifyingEmailOtp(false);
    }
  }, [emailOtp, session?.accessToken]);

  const handleConfirmTwoFactor = useCallback(async () => {
    if (!session?.accessToken || authCode.trim().length < 6) {
      return;
    }
    setConfirmingAuth(true);
    setEnableError(null);
    try {
      const status = await confirmTwoFactor(
        { code: authCode.trim() },
        session.accessToken
      );
      setTwoFactorStatus(status);
      setSetupInfo(null);
      setEmailOtp("");
      setAuthCode("");
      setEnableModalVisible(false);
      setEnableStep("email");
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to confirm the authenticator code.";
      setEnableError(message);
      setError(message);
    } finally {
      setConfirmingAuth(false);
    }
  }, [authCode, loadStatus, session?.accessToken]);

  const handleDisableTwoFactor = useCallback(async () => {
    if (!session?.accessToken || disableCode.trim().length < 6) {
      return;
    }
    setDisablingTwoFactor(true);
    setDisableError(null);
    try {
      const status = await disableTwoFactor(
        { code: disableCode.trim() },
        session.accessToken
      );
      setTwoFactorStatus(status);
      setSetupInfo(null);
      setEmailOtp("");
      setAuthCode("");
      setDisableCode("");
      setDisableModalVisible(false);
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to disable two-factor auth.";
      setDisableError(message);
      setError(message);
    } finally {
      setDisablingTwoFactor(false);
    }
  }, [disableCode, loadStatus, session?.accessToken]);

  const handleToggleTwoFactor = useCallback(
    async (next: boolean) => {
      await Haptics.selectionAsync();
      if (!session?.accessToken) {
        return;
      }
      if (next) {
        setEnableStep("email");
        setEmailOtp("");
        setAuthCode("");
        setEnableError(null);
        setSetupInfo(null);
        setEnableModalVisible(true);
        try {
          await handleSendEmailOtp();
        } catch {
          // handled via enableError state
        }
      } else {
        setDisableCode("");
        setDisableError(null);
        setDisableModalVisible(true);
      }
    },
    [handleSendEmailOtp, session?.accessToken]
  );

  const closeEnableModal = useCallback(() => {
    setEnableModalVisible(false);
    setEnableStep("email");
    setEnableError(null);
    setEmailOtp("");
    setAuthCode("");
  }, []);

  const closeDisableModal = useCallback(() => {
    setDisableModalVisible(false);
    setDisableError(null);
    setDisableCode("");
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadStatus(), loadSessions()]);
    } catch (error) {
      console.warn("Failed to refresh security status", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions, loadStatus]);

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
          <Text style={styles.title}>Security</Text>
          <Text style={styles.subtitle}>
            Keep your workspace locked down with two-factor and device controls.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Two-factor authentication</Text>
              <Text style={styles.rowDetail}>
                Require a code from your authenticator app when signing in on
                new devices.
              </Text>
            </View>
            <Switch
              value={Boolean(twoFactorStatus?.enabled)}
              onValueChange={handleToggleTwoFactor}
              disabled={
                statusLoading ||
                enableModalVisible ||
                disableModalVisible ||
                sendingEmail ||
                verifyingEmailOtp ||
                confirmingAuth ||
                disablingTwoFactor
              }
              trackColor={{
                false: Theme.palette.border,
                true: Theme.palette.ink,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Modal transparent visible={enableModalVisible} animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {enableStep === "email"
                  ? "Verify your email"
                  : "Connect your authenticator"}
              </Text>
              <Text style={styles.modalDetail}>
                {enableStep === "email"
                  ? `We sent a six-digit code to ${
                      user?.email ?? "your email"
                    }. Enter it to continue.`
                  : "Scan the QR code or enter the secret, then type the code from your authenticator app."}
              </Text>
              {enableStep === "email" ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={emailOtp}
                    onChangeText={setEmailOtp}
                    placeholder="Email code"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.modalActions}>
                    <Pressable
                      style={[
                        styles.modalButton,
                        styles.modalButtonFull,
                        styles.modalSecondary,
                      ]}
                      onPress={resendEmailOtp}
                      disabled={sendingEmail}
                    >
                      <Text style={styles.modalSecondaryText}>
                        {sendingEmail ? "Sending…" : "Resend email"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modalButton,
                        styles.modalButtonFull,
                        styles.modalPrimary,
                        (emailOtp.trim().length < 6 || verifyingEmailOtp) &&
                          styles.actionButtonDisabled,
                      ]}
                      onPress={handleVerifyEmailOtp}
                      disabled={emailOtp.trim().length < 6 || verifyingEmailOtp}
                    >
                      <Text style={styles.modalPrimaryText}>
                        {verifyingEmailOtp ? "Verifying…" : "Continue"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {setupInfo?.otpauth_url ? (
                    <View style={styles.qrWrapper}>
                      <QrCode value={setupInfo.otpauth_url} size={180} />
                    </View>
                  ) : (
                    <Text style={styles.helperText}>
                      Generating your QR code…
                    </Text>
                  )}
                  {setupInfo?.secret ? (
                    <View style={styles.secretBox}>
                      <View style={styles.secretHeader}>
                        <Text style={styles.secretLabel}>
                          Manual entry secret
                        </Text>
                        <Pressable
                          style={styles.copyButton}
                          onPress={async () => {
                            await Clipboard.setString(setupInfo.secret);
                            await Haptics.selectionAsync();
                            setCopiedSecret(true);
                            setTimeout(() => setCopiedSecret(false), 2000);
                          }}
                        >
                          <Feather
                            name={copiedSecret ? "check" : "copy"}
                            size={16}
                            color={
                              copiedSecret
                                ? Theme.palette.success
                                : Theme.palette.ink
                            }
                          />
                        </Pressable>
                      </View>
                      <Text style={styles.secretValue}>{setupInfo.secret}</Text>
                    </View>
                  ) : null}
                  <TextInput
                    style={styles.input}
                    value={authCode}
                    onChangeText={setAuthCode}
                    placeholder="Authenticator code"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    style={[
                      styles.modalButton,
                      styles.modalPrimary,
                      (authCode.trim().length < 6 || confirmingAuth) &&
                        styles.actionButtonDisabled,
                    ]}
                    onPress={handleConfirmTwoFactor}
                    disabled={authCode.trim().length < 6 || confirmingAuth}
                  >
                    <Text style={styles.modalPrimaryText}>
                      {confirmingAuth ? "Confirming…" : "Confirm 2FA"}
                    </Text>
                  </Pressable>
                </>
              )}
              {enableError ? (
                <Text style={styles.errorText}>{enableError}</Text>
              ) : null}
              <Pressable style={styles.modalCancel} onPress={closeEnableModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal transparent visible={disableModalVisible} animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Turn off two-factor</Text>
              <Text style={styles.modalDetail}>
                Enter the current authenticator code to disable 2FA on this
                account.
              </Text>
              <TextInput
                style={styles.input}
                value={disableCode}
                onChangeText={setDisableCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              {disableError ? (
                <Text style={styles.errorText}>{disableError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalButtonFull,
                    styles.modalSecondary,
                  ]}
                  onPress={closeDisableModal}
                >
                  <Text style={styles.modalSecondaryText}>Dismiss</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalButtonFull,
                    styles.modalDanger,
                    (disableCode.trim().length < 6 || disablingTwoFactor) &&
                      styles.actionButtonDisabled,
                  ]}
                  onPress={handleDisableTwoFactor}
                  disabled={disableCode.trim().length < 6 || disablingTwoFactor}
                >
                  <Text style={styles.modalDangerText}>
                    {disablingTwoFactor ? "Disabling…" : "Disable 2FA"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Devices & sessions</Text>
            <Text style={styles.cardSubtitle}>
              Signed-in devices that can access DueSoon.
            </Text>
          </View>
          {sessionsLoading && sessions.length === 0 ? (
            <View style={styles.sessionRow}>
              <Text style={styles.sessionMeta}>Loading sessions…</Text>
            </View>
          ) : sessionsError ? (
            <View style={styles.sessionRow}>
              <Text style={styles.errorText}>{sessionsError}</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.sessionRow}>
              <Text style={styles.sessionMeta}>
                No active sessions. Sign in on another device to see it here.
              </Text>
            </View>
          ) : (
            sessions.map((session, index) => {
              const deviceLabel = buildSessionDeviceLabel(session);
              const locationLabel = session.location || session.ip_address || "Unknown location";
              const lastActive = session.last_active
                ? formatRelativeTime(session.last_active)
                : "Unknown activity";
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    index === sessions.length - 1 && styles.sessionRowLast,
                  ]}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDevice}>{deviceLabel}</Text>
                    <Text style={styles.sessionMeta}>{locationLabel}</Text>
                    <Text style={styles.sessionMeta}>{lastActive}</Text>
                  </View>
                  {session.current ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>This device</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.logOutButton}
                      onPress={() => handleLogOutSession(session.id)}
                    >
                      <Text style={styles.logOutButtonText}>Log out</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildSessionDeviceLabel(session: SessionInfo) {
  const platformLabel = formatPlatformLabel(session.platform);
  const base = session.device_name || session.user_agent || "Unknown device";
  if (platformLabel) {
    return `${base} · ${platformLabel}`;
  }
  return base;
}

function formatPlatformLabel(value?: string | null) {
  if (!value) {
    return "";
  }
  const normalized = value.toLowerCase();
  if (normalized === "ios") return "iOS";
  if (normalized === "android") return "Android";
  if (normalized === "web") return "Web";
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  card: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  rowDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  helperText: {
    fontSize: 13,
    color: Theme.palette.slate,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  input: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Theme.palette.ink,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
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
  modalDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
    width: "100%",
  },
  modalButton: {
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonFull: {
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  modalPrimary: {
    borderColor: Theme.palette.ink,
    backgroundColor: Theme.palette.ink,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalSecondary: {
    borderColor: Theme.palette.border,
    backgroundColor: Theme.palette.surface,
  },
  modalSecondaryText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  modalDanger: {
    borderColor: "rgba(180, 35, 24, 0.4)",
    backgroundColor: "rgba(243, 174, 168, 0.3)",
  },
  modalDangerText: {
    color: "#B42318",
    fontWeight: "600",
  },
  modalCancel: {
    marginTop: Theme.spacing.sm,
  },
  modalCancelText: {
    textAlign: "center",
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  qrWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.sm,
  },
  secretBox: {
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.surface,
    padding: Theme.spacing.md,
    gap: 4,
  },
  secretHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  secretLabel: {
    fontSize: 12,
    color: Theme.palette.slate,
  },
  secretValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
    letterSpacing: 2,
  },
  copyButton: {
    padding: Theme.spacing.xs,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.palette.border,
    gap: Theme.spacing.md,
  },
  sessionRowLast: {
    borderBottomWidth: 0,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionDevice: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  sessionMeta: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  currentBadge: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  currentBadgeText: {
    fontSize: 13,
    color: Theme.palette.slate,
    fontWeight: "600",
  },
  logOutButton: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: "rgba(180, 35, 24, 0.3)",
    backgroundColor: "rgba(243, 174, 168, 0.35)",
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  logOutButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#B42318",
  },
});
