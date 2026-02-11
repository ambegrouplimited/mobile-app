import { Asset } from "expo-asset";

const PLATFORM_DEFINITIONS = {
  gmail: {
    label: "Gmail",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/gmail.svg")).uri,
  },
  outlook: {
    label: "Outlook",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/outlook.svg")).uri,
  },
  slack: {
    label: "Slack",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/slack.svg")).uri,
  },
  whatsapp: {
    label: "WhatsApp Business",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/whatsapp.svg")).uri,
  },
  telegram: {
    label: "Telegram Business",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/telegram.svg")).uri,
  },
  discord: {
    label: "Discord",
    assetUri: Asset.fromModule(require("@/assets/contactPlatforms/discord.svg")).uri,
  },
} as const;

export type ContactPlatformId = keyof typeof PLATFORM_DEFINITIONS;

export type ContactPlatformInfo = {
  id: string;
  label: string;
  assetUri?: string;
};

export const CONTACT_PLATFORM_INFO = PLATFORM_DEFINITIONS;

export function getContactPlatformInfo(platform?: string): ContactPlatformInfo {
  if (platform && PLATFORM_DEFINITIONS[platform as ContactPlatformId]) {
    const definition = PLATFORM_DEFINITIONS[platform as ContactPlatformId];
    return { id: platform, label: definition.label, assetUri: definition.assetUri };
  }
  return { id: platform ?? "custom", label: platform ?? "Email" };
}

export const CONTACT_PLATFORM_OPTIONS: Array<{
  id: ContactPlatformId;
  label: string;
  detail: string;
}> = [
  {
    id: "gmail",
    label: "Gmail",
    detail: "Send threaded reminders with your Gmail account.",
  },
  {
    id: "outlook",
    label: "Outlook",
    detail: "Follow up through Outlook or Microsoft 365.",
  },
  {
    id: "slack",
    label: "Slack DM",
    detail: "Drop a gentle nudge in their Slack workspace.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    detail: "Use your WhatsApp Business number for encrypted chats.",
  },
  {
    id: "telegram",
    label: "Telegram Business",
    detail: "Keep reminders in their Telegram Business inbox.",
  },
];
