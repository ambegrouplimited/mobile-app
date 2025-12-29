import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { PushPlatform } from "@/services/notifications";

type DevicePushToken = {
  token: string;
  platform: PushPlatform;
};

export async function requestDevicePushToken(): Promise<DevicePushToken | null> {
  if (!Device.isDevice) {
    return null;
  }
  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (permissions.status !== "granted") {
    return null;
  }
  const pushToken = await Notifications.getDevicePushTokenAsync();
  const platform: PushPlatform = Platform.OS === "android" ? "android" : Platform.OS === "ios" ? "ios" : "web";
  return { token: pushToken.data, platform };
}
