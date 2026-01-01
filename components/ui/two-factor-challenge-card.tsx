import { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { Theme } from "@/constants/theme";

type Props = {
  visible: boolean;
  email?: string;
  onSubmit: (code: string) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  onRequestRecovery?: () => Promise<void> | void;
  onSubmitRecovery?: (code: string) => Promise<void> | void;
  recovery?: {
    requested: boolean;
    sending: boolean;
    verifying: boolean;
    error?: string | null;
  };
};

export function TwoFactorChallengeCard({
  visible,
  email,
  onSubmit,
  onCancel,
  loading = false,
  error,
  onRequestRecovery,
  onSubmitRecovery,
  recovery,
}: Props) {
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (!visible) {
      setCode("");
      setRecoveryCode("");
    }
  }, [visible]);

  useEffect(() => {
    if (!recovery?.requested) {
      setRecoveryCode("");
    }
  }, [recovery?.requested]);

  if (!visible) {
    return null;
  }

  const handleSubmit = () => {
    if (!code.trim()) {
      return;
    }
    onSubmit(code.trim());
  };

  const handleRecoverySubmit = () => {
    if (!onSubmitRecovery || recoveryCode.trim().length < 6) {
      return;
    }
    onSubmitRecovery(recoveryCode.trim());
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.challengeCard}>
        <Text style={styles.challengeTitle}>Enter your 2FA code</Text>
        <Text style={styles.challengeDetail}>
          {email
            ? `Open your authenticator and enter the 6-digit code for ${email}.`
            : "Open your authenticator and enter the 6-digit code to finish signing in."}
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={6}
          placeholder="123456"
          style={styles.input}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.challengeActions}>
          <Pressable style={[styles.challengeButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.challengeButton,
              styles.submitButton,
              (loading || code.trim().length < 6) && styles.disabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || code.trim().length < 6}
          >
            <Text style={styles.submitText}>{loading ? "Verifying…" : "Verify"}</Text>
          </Pressable>
        </View>
        {onRequestRecovery ? (
          <View style={styles.recoverySection}>
            {recovery?.requested ? (
              <>
                <Text style={styles.recoveryTitle}>Use email instead</Text>
                <Text style={styles.recoveryDetail}>
                  We sent a login code to your account email. Enter it below to finish signing in. This
                  turns off 2FA on your account.
                </Text>
                <TextInput
                  value={recoveryCode}
                  onChangeText={setRecoveryCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoCorrect={false}
                  autoCapitalize="none"
                  maxLength={6}
                  placeholder="123456"
                  style={styles.input}
                />
                {recovery?.error ? <Text style={styles.errorText}>{recovery.error}</Text> : null}
                <View style={styles.challengeActions}>
                  <Pressable
                    style={[styles.challengeButton, styles.cancelButton]}
                    onPress={onRequestRecovery}
                    disabled={Boolean(recovery?.sending)}
                  >
                    <Text style={styles.cancelText}>
                      {recovery?.sending ? "Sending…" : "Resend code"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.challengeButton,
                      styles.submitButton,
                      (recovery?.verifying || recoveryCode.trim().length < 6) && styles.disabled,
                    ]}
                    onPress={handleRecoverySubmit}
                    disabled={recovery?.verifying || recoveryCode.trim().length < 6}
                  >
                    <Text style={styles.submitText}>
                      {recovery?.verifying ? "Verifying…" : "Use email code"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable style={styles.recoveryButton} onPress={onRequestRecovery}>
                <Text style={styles.recoveryButtonText}>
                  Can't access your authenticator? Email a login code.
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  challengeCard: {
    width: "100%",
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  challengeDetail: {
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
    fontWeight: "600",
    letterSpacing: 6,
    textAlign: "center",
    color: Theme.palette.ink,
  },
  errorText: {
    fontSize: 13,
    color: "#B42318",
  },
  challengeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  challengeButton: {
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: Theme.palette.border,
    backgroundColor: "#FFFFFF",
  },
  submitButton: {
    borderColor: Theme.palette.ink,
    backgroundColor: Theme.palette.ink,
  },
  cancelText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  recoverySection: {
    marginTop: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.palette.border,
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  recoveryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  recoveryDetail: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  recoveryButton: {
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  recoveryButtonText: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
});
