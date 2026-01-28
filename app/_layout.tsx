import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { Theme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/providers/auth-provider";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const statusBarStyle: "light" | "dark" = "dark";
  const backgroundColor =
    colorScheme === "dark"
      ? Theme.palette?.ink ?? "#000000"
      : Theme.palette?.background ?? "#FFFFFF";

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <KeyboardAvoidingView
            style={[styles.keyboardAvoiding, { backgroundColor }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
              <Stack.Screen name="client/[id]" options={{ headerShown: false }} />
              <Stack.Screen
                name="client/[id]/timezone"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="reminders/[id]/index"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="reminders/[id]/history"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="reminders/[id]/summary"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="profile/account"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/index"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/notifications"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/payment-methods"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/payment-methods/catalog"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/payment-methods/[id]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/currency"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/timezone"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/messaging-connections"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/slack"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="settings/security"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="onboarding/currency"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="onboarding/timezone"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="onboarding/subscription"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-reminder/contact-platform"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-reminder/send-options"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-reminder/payment-method"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-reminder/schedule"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="new-reminder/summary"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="messages/[clientId]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="past-clients"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="clients/not-paid"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="clients/paid" options={{ headerShown: false }} />
            </Stack>
          </KeyboardAvoidingView>
          <StatusBar
            key={colorScheme}
            style={statusBarStyle}
            translucent
            backgroundColor="transparent"
          />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
});
