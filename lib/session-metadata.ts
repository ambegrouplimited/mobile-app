import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

export type SessionClientMetadataPayload = {
  device_name?: string;
  platform?: string;
  app_version?: string;
  app_build?: string;
  location?: string;
};

export function buildSessionClientMetadata(): SessionClientMetadataPayload {
  const appVersion =
    Constants.expoConfig?.version ??
    Constants.manifest2?.version ??
    undefined;
  const appBuild = Constants.nativeBuildVersion ?? undefined;
  const platform =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : "web";
  const deviceName =
    Device.deviceName ??
    Device.modelName ??
    `${platform.charAt(0).toUpperCase()}${platform.slice(1)} device`;
  const location =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? undefined;

  const payload: SessionClientMetadataPayload = {
    device_name: deviceName,
    platform,
    app_version: appVersion,
    app_build: appBuild,
    location,
  };

  Object.keys(payload).forEach((key) => {
    const typedKey = key as keyof SessionClientMetadataPayload;
    if (payload[typedKey] === undefined || payload[typedKey] === null) {
      delete payload[typedKey];
    }
  });

  return payload;
}
