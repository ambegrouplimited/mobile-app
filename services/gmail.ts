import { apiFetch, toQueryString } from "@/lib/api-client";

export type GmailStatus = {
  connected: boolean;
  expires_at?: string;
  onboarding_url?: string;
};

export function fetchGmailStatus(token: string, options?: { redirectUri?: string }) {
  const query = toQueryString({
    redirect_uri: options?.redirectUri,
  });
  return apiFetch<GmailStatus>(`/api/email/gmail${query}`, {
    method: "GET",
    token,
  });
}

export function connectGmailAccount(
  payload: { code: string; state: string; redirectUri?: string },
  token: string,
) {
  const query = toQueryString({
    code: payload.code,
    state: payload.state,
    redirect_uri: payload.redirectUri,
  });
  return apiFetch<GmailStatus>(`/api/email/gmail/connect${query}`, {
    method: "POST",
    token,
  });
}

export function disconnectGmailAccount(token: string) {
  return apiFetch<void>("/api/email/gmail", {
    method: "DELETE",
    token,
  });
}
