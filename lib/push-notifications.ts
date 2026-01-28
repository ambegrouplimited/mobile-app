import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

export async function requestExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice && !__DEV__) {
    return null;
  }
  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (permissions.status !== "granted") {
    return null;
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("Expo projectId not found; cannot register push token.");
    return null;
  }
  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
  return expoToken.data ?? null;
}

export const requestDevicePushToken = requestExpoPushToken;
