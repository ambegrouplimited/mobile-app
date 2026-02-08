import { apiFetch, toQueryString } from "@/lib/api-client";

export type WhatsAppTemplate = {
  content_sid: string;
  friendly_name: string;
  status: string;
  tone?: string | null;
  updated_at?: string | null;
};

export type WhatsAppSender = {
  id: string;
  phone_number: string;
  status: string;
  updated_at?: string | null;
};

export type WhatsAppAccount = {
  connected: boolean;
  onboarding_url?: string | null;
  embedded_signup_state?: string | null;
  status?: string | null;
  phone_number?: string | null;
  phone_number_id?: string | null;
  business_name?: string | null;
  access_token_expires_at?: string | null;
  updated_at?: string | null;
};

export type WhatsAppStatus = {
  onboarding_url?: string | null;
  account?: WhatsAppAccount | null;
  senders: WhatsAppSender[];
  templates: WhatsAppTemplate[];
  token_warning_days?: number | null;
};

export type WhatsAppOnboardingPayload = {
  state: string;
  phone_number: string;
  display_name?: string | null;
  business_name?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  code?: string | null;
  access_token?: string | null;
  pin?: string;
};

export function fetchWhatsAppStatus(token: string) {
  return apiFetch<WhatsAppStatus>("/api/messaging/whatsapp", { token });
}

export function initiateWhatsAppConnect(token: string, redirectUri?: string) {
  const query = redirectUri ? toQueryString({ redirect_uri: redirectUri }) : "";
  return apiFetch<WhatsAppAccount>(
    `/api/messaging/whatsapp/connect${query}`,
    {
      method: "POST",
      token,
    }
  );
}

export function completeWhatsAppOnboarding(
  payload: WhatsAppOnboardingPayload,
  token: string
) {
  return apiFetch<WhatsAppAccount>(
    "/api/messaging/whatsapp/onboarding-complete",
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export function disconnectWhatsApp(token: string) {
  return apiFetch<void>("/api/messaging/whatsapp", {
    method: "DELETE",
    token,
  });
}
