import { apiFetch } from "@/lib/api-client";

export type TelegramConnection = {
  connected?: boolean;
  connection_id?: string;
  onboarding_url?: string;
  telegram_username?: string;
};

export type TelegramChat = {
  chat_id?: string;
  title?: string;
  type?: string;
};

export type TelegramStatus = {
  has_started_bot: boolean;
  has_business_connection: boolean;
  onboarding_url?: string;
  connection: TelegramConnection | null;
  chats: TelegramChat[];
};

export function fetchTelegramStatus(token: string) {
  return apiFetch<TelegramStatus>("/api/messaging/telegram", {
    method: "GET",
    token,
  });
}

export function disconnectTelegram(token: string) {
  return apiFetch<void>("/api/messaging/telegram", {
    method: "DELETE",
    token,
  });
}
