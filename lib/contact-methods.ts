import { Asset } from "expo-asset";

import type { ContactMethod } from "@/types/clients";

const CONTACT_LOGOS = {
  email: Asset.fromModule(require("@/assets/contactPlatforms/inbox.svg")).uri,
  whatsapp: Asset.fromModule(require("@/assets/contactPlatforms/whatsapp.svg")).uri,
  telegram: Asset.fromModule(require("@/assets/contactPlatforms/telegram.svg")).uri,
  slack: Asset.fromModule(require("@/assets/contactPlatforms/slack.svg")).uri,
} as const;

export function contactLogoForMethod(type: ContactMethod["type"]) {
  switch (type) {
    case "whatsapp":
      return CONTACT_LOGOS.whatsapp;
    case "telegram":
      return CONTACT_LOGOS.telegram;
    case "slack":
      return CONTACT_LOGOS.slack;
    default:
      return CONTACT_LOGOS.email;
  }
}

export function formatMethodLabel(method: ContactMethod) {
  switch (method.type) {
    case "email":
      return "Email";
    case "email_gmail":
      return "Gmail";
    case "email_outlook":
      return "Outlook";
    case "whatsapp":
      return "WhatsApp";
    case "telegram":
      return "Telegram";
    case "slack":
      return "Slack";
    default:
      return "Contact";
  }
}

export function getContactSummary(method: ContactMethod) {
  if (method.email) return method.email;
  if (method.phone) return method.phone;
  if (method.telegram_username) return method.telegram_username;
  if (method.telegram_chat_id) return method.telegram_chat_id;
  if (method.slack_user_id) return `Slack ${method.slack_user_id}`;
  return method.label ?? "Contact";
}

export function resolvePlatformFromMethod(type: ContactMethod["type"]) {
  switch (type) {
    case "email":
    case "email_gmail":
      return "gmail";
    case "email_outlook":
      return "outlook";
    case "whatsapp":
      return "whatsapp";
    case "telegram":
      return "telegram";
    case "slack":
      return "slack";
    default:
      return null;
  }
}
