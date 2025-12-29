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
};

export function TwoFactorChallengeCard({
  visible,
  email,
  onSubmit,
  onCancel,
  loading = false,
  error,
}: Props) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!visible) {
      setCode("");
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleSubmit = () => {
    if (!code.trim()) {
      return;
    }
    onSubmit(code.trim());
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
});
