import { apiFetch } from "@/lib/api-client";

export type TelegramConnection = {
  connected?: boolean;
  connection_id?: string;
  onboarding_url?: string;
  telegram_username?: string;
};

export type TelegramContact = {
  chat_id: string;
  name?: string | null;
  username?: string | null;
  assigned_client_id?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
};

export type TelegramStatus = {
  has_started_bot: boolean;
  has_business_connection: boolean;
  onboarding_url?: string;
  connection: TelegramConnection | null;
  chats: TelegramContact[];
};

export function fetchTelegramStatus(token: string) {
  return apiFetch<TelegramStatus>("/api/messaging/telegram", {
    method: "GET",
    token,
  });
}

export function fetchTelegramContacts(token: string) {
  return apiFetch<TelegramContact[]>("/api/messaging/telegram/contacts", {
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
