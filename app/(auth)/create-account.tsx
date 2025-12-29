import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/components/ui/auth-button";
import { TwoFactorChallengeCard } from "@/components/ui/two-factor-challenge-card";
import { Theme } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function CreateAccountScreen() {
  const router = useRouter();
  const {
    loginWithGoogle,
    loginWithApple,
    isAuthenticating,
    error,
    dismissError,
    oauthReady,
    twoFactorChallenge,
    submitTwoFactorCode,
    cancelTwoFactorChallenge,
    twoFactorError,
    twoFactorVerifying,
  } = useAuth();
  const [touched, setTouched] = useState(false);

  const runAuthFlow = useCallback(
    async (provider: "google" | "apple") => {
      setTouched(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        if (provider === "google") {
          await loginWithGoogle();
        } else {
          await loginWithApple();
        }
      } catch {
        // surfaced via context
      }
    },
    [loginWithApple, loginWithGoogle],
  );

  useEffect(() => {
    if (error && touched) {
      Alert.alert("Sign-up issue", error, [{ text: "OK", onPress: dismissError }], { cancelable: true });
    }
  }, [dismissError, error, touched]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={32} color={Theme.palette.ink} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <AuthButton
            label="Sign up with Google"
            onPress={() => runAuthFlow("google")}
            disabled={isAuthenticating || !oauthReady.google}
            loading={isAuthenticating}
            variant="accent"
            icon={<Feather name="mail" size={18} color="#FFFFFF" />}
            iconColor="#FFFFFF"
          />
          <AuthButton
            label="Sign up with Apple"
            onPress={() => runAuthFlow("apple")}
            disabled={isAuthenticating || !oauthReady.apple}
            loading={isAuthenticating}
            variant="outline"
            icon={<FontAwesome name="apple" size={20} color={Theme.palette.ink} />}
            iconColor={Theme.palette.ink}
          />
          <Text style={styles.footnote}>By continuing you agree to our terms of service and privacy policy.</Text>
        </View>
        <TwoFactorChallengeCard
          visible={Boolean(twoFactorChallenge)}
          email={twoFactorChallenge?.email}
          onSubmit={submitTwoFactorCode}
          onCancel={cancelTwoFactorChallenge}
          loading={twoFactorVerifying}
          error={twoFactorError}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    gap: Theme.spacing.lg,
  },
  topRow: {
    position: "absolute",
    top: Theme.spacing.xl,
    left: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.xs,
  },
  actions: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: Theme.spacing.md,
  },
  footnote: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
    textAlign: "center",
  },
});
