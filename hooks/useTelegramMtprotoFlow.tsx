import { ReactNode, useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { TelegramMtprotoModal, TelegramMtprotoStep } from "@/components/TelegramMtprotoModal";
import {
  startTelegramMtprotoLogin,
  submitTelegramMtprotoCode,
  submitTelegramMtprotoPassword,
} from "@/services/telegram";

type Options = {
  token?: string | null;
  onCompleted?: () => void;
};

type HookReturn = {
  openFlow: (initialPhone?: string) => void;
  modal: ReactNode;
  isVisible: boolean;
  currentStep: TelegramMtprotoStep;
};

export function useTelegramMtprotoFlow({
  token,
  onCompleted,
}: Options = {}): HookReturn {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<TelegramMtprotoStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number>(0);

  const reset = useCallback(() => {
    setStep("phone");
    setPhoneNumber("");
    setCode("");
    setPassword("");
    setChallengeId(null);
    setError(null);
    setStatusMessage(null);
    setLastSentAt(0);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    reset();
  }, [reset]);

  const ensureToken = useCallback(() => {
    if (!token) {
      Alert.alert(
        "Sign in required",
        "You need to sign in again before connecting Telegram.",
      );
      return false;
    }
    return true;
  }, [token]);

  const sendPhone = useCallback(async () => {
    if (!ensureToken()) return;
    const normalized = phoneNumber.trim();
    if (!normalized) {
      setError("Enter the phone number tied to your Telegram account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await startTelegramMtprotoLogin(token!, normalized);
      setChallengeId(response.challenge_id);
      setStatusMessage(`Enter the code sent to ${response.phone_number}.`);
      setStep("code");
      setCode("");
      setLastSentAt(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to contact Telegram. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [ensureToken, phoneNumber, token]);

  const verifyCode = useCallback(async () => {
    if (!ensureToken() || !challengeId) return;
    const sanitized = code.trim();
    if (!sanitized) {
      setError("Enter the code you received from Telegram.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await submitTelegramMtprotoCode(
        token!,
        challengeId,
        sanitized,
      );
      if (response.status === "password_required") {
        setPassword("");
        setStep("password");
        setStatusMessage("Enter your Telegram two-factor password.");
      } else {
        setStep("success");
        setStatusMessage(null);
        onCompleted?.();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify the code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [challengeId, code, ensureToken, onCompleted, token]);

  const verifyPassword = useCallback(async () => {
    if (!ensureToken() || !challengeId) return;
    if (!password) {
      setError("Enter your Telegram password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitTelegramMtprotoPassword(token!, challengeId, password);
      setStep("success");
      setStatusMessage(null);
      onCompleted?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify that password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [challengeId, ensureToken, onCompleted, password, token]);

  const openFlow = useCallback(
    (initialPhone?: string) => {
      if (!ensureToken()) return;
      reset();
      if (initialPhone) {
        setPhoneNumber(initialPhone);
      }
      setVisible(true);
    },
    [ensureToken, reset],
  );

  const canResend = useMemo(() => {
    if (!challengeId) return false;
    if (!lastSentAt) return true;
    return Date.now() - lastSentAt > 30000;
  }, [challengeId, lastSentAt]);

  const modal = useMemo(
    () => (
      <TelegramMtprotoModal
        visible={visible}
        step={step}
        phoneNumber={phoneNumber}
        onPhoneChange={setPhoneNumber}
        onSubmitPhone={sendPhone}
        code={code}
        onCodeChange={setCode}
        onSubmitCode={verifyCode}
        password={password}
        onPasswordChange={setPassword}
        onSubmitPassword={verifyPassword}
        onClose={step === "success" ? close : () => setVisible(false)}
        busy={busy}
        error={error}
        statusMessage={statusMessage}
        canResend={canResend}
        onResend={canResend ? sendPhone : undefined}
      />
    ),
    [
      busy,
      canResend,
      close,
      code,
      error,
      password,
      phoneNumber,
      sendPhone,
      statusMessage,
      step,
      verifyCode,
      verifyPassword,
      visible,
    ],
  );

  return {
    openFlow,
    modal,
    isVisible: visible,
    currentStep: step,
  };
}
