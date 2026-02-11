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
  source?: string | null;
};

export type TelegramMtprotoStatus = {
  connected: boolean;
  phone_number?: string | null;
  telegram_username?: string | null;
  connected_at?: string | null;
  updated_at?: string | null;
  last_keepalive_at?: string | null;
  last_error?: string | null;
};

export type TelegramStatus = {
  has_started_bot: boolean;
  has_business_connection: boolean;
  onboarding_url?: string;
  connection: TelegramConnection | null;
  chats: TelegramContact[];
  mtproto?: TelegramMtprotoStatus | null;
  mtproto_supported?: boolean;
};

export type TelegramMtprotoStartResponse = {
  challenge_id: string;
  phone_number: string;
  code_type?: string | null;
  expires_at: string;
};

export type TelegramMtprotoChallengeResponse = {
  status: "completed" | "password_required";
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

export function startTelegramMtprotoLogin(token: string, phone_number: string) {
  return apiFetch<TelegramMtprotoStartResponse>("/api/messaging/telegram/mtproto/login", {
    method: "POST",
    token,
    body: { phone_number },
  });
}

export function submitTelegramMtprotoCode(
  token: string,
  challengeId: string,
  code: string,
) {
  return apiFetch<TelegramMtprotoChallengeResponse>(
    `/api/messaging/telegram/mtproto/login/${challengeId}/code`,
    {
      method: "POST",
      token,
      body: { code },
    },
  );
}

export function submitTelegramMtprotoPassword(
  token: string,
  challengeId: string,
  password: string,
) {
  return apiFetch<TelegramMtprotoChallengeResponse>(
    `/api/messaging/telegram/mtproto/login/${challengeId}/password`,
    {
      method: "POST",
      token,
      body: { password },
    },
  );
}

export function deleteTelegramMtprotoSession(token: string) {
  return apiFetch<void>("/api/messaging/telegram/mtproto/session", {
    method: "DELETE",
    token,
  });
}
