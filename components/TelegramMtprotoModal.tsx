import { Feather } from "@expo/vector-icons";
import { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Theme } from "@/constants/theme";

export type TelegramMtprotoStep = "phone" | "code" | "password" | "success";

type Props = {
  visible: boolean;
  step: TelegramMtprotoStep;
  phoneNumber: string;
  onPhoneChange: (value: string) => void;
  onSubmitPhone: () => void;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmitCode: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmitPassword: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
  statusMessage?: string | null;
  canResend?: boolean;
  onResend?: () => void;
};

export function TelegramMtprotoModal({
  visible,
  step,
  phoneNumber,
  onPhoneChange,
  onSubmitPhone,
  code,
  onCodeChange,
  onSubmitCode,
  password,
  onPasswordChange,
  onSubmitPassword,
  onClose,
  busy,
  error,
  statusMessage,
  canResend,
  onResend,
}: Props) {
  const renderBody = (): ReactNode => {
    if (step === "success") {
      return (
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <Feather name="check" size={20} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Telegram session ready</Text>
          <Text style={styles.successDetail}>
            We will keep this session active so reminders can keep flowing.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <>
        {step === "phone" ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.modalLabel}>Telegram phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 555 5555"
              placeholderTextColor={Theme.palette.slate}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              value={phoneNumber}
              onChangeText={onPhoneChange}
            />
          </View>
        ) : null}
        {step === "code" ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.modalLabel}>Telegram code</Text>
            <TextInput
              style={styles.input}
              placeholder="12345"
              placeholderTextColor={Theme.palette.slate}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              value={code}
              onChangeText={(value) => onCodeChange(value.replace(/\\D/g, ""))}
              maxLength={10}
            />
          </View>
        ) : null}
        {step === "password" ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.modalLabel}>Telegram password</Text>
            <TextInput
              style={styles.input}
              placeholder="Two-factor password"
              placeholderTextColor={Theme.palette.slate}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={onPasswordChange}
            />
          </View>
        ) : null}
        {statusMessage ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}
        {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
        {step === "code" && canResend && onResend ? (
          <Pressable style={styles.resendButton} onPress={onResend}>
            <Text style={styles.resendText}>Resend code</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
          disabled={busy}
          onPress={() => {
            if (step === "phone") {
              onSubmitPhone();
            } else if (step === "code") {
              onSubmitCode();
            } else if (step === "password") {
              onSubmitPassword();
            }
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === "phone"
                ? "Send code"
                : step === "code"
                  ? "Verify code"
                  : "Verify password"}
            </Text>
          )}
        </Pressable>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Connect Telegram account</Text>
            <Pressable onPress={onClose} disabled={busy}>
              <Feather name="x" size={20} color={Theme.palette.slate} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>
            Sign into your Telegram account so DueSoon can keep business chats
            active for reminders.
          </Text>
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Theme.palette.slate,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.palette.ink,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Theme.palette.ink,
    backgroundColor: Theme.palette.surface,
  },
  statusMessage: {
    fontSize: 13,
    color: Theme.palette.ink,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: Theme.palette.accent,
    marginBottom: 8,
  },
  resendButton: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.palette.accent,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: Theme.palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  successState: {
    alignItems: "center",
    gap: 12,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.palette.success,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  successDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: Theme.palette.slate,
    textAlign: "center",
    marginBottom: 8,
  },
});
