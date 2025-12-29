import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/components/ui/auth-button";
import { Theme } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticating } = useAuth();

  const handleCreateAccount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/create-account");
  }, [router]);

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/sign-in");
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrapper}>
          <Image source={require("@/assets/images/duesoonLogo.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.actions}>
          <AuthButton
            label="Create my account"
            onPress={handleCreateAccount}
            disabled={isAuthenticating}
            loading={false}
            variant="accent"
            icon={<Feather name="user-plus" size={18} color="#FFFFFF" />}
            iconColor="#FFFFFF"
          />
          <AuthButton
            label="Login"
            onPress={handleLogin}
            disabled={isAuthenticating}
            loading={isAuthenticating}
            variant="outline"
            icon={<FontAwesome name="sign-in" size={18} color={Theme.palette.ink} />}
            iconColor={Theme.palette.ink}
          />
          <Text style={styles.footnote}>By continuing you agree to our terms of service and privacy policy.</Text>
        </View>
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 360,
    height: 360,
  },
  actions: {
    width: "100%",
    maxWidth: 420,
    gap: Theme.spacing.md,
  },
  footnote: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
    textAlign: "center",
  },
});
