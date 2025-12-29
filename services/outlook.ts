import { apiFetch, toQueryString } from "@/lib/api-client";

export type OutlookStatus = {
  connected: boolean;
  email_address?: string;
  expires_at?: string;
  onboarding_url?: string;
};

export function fetchOutlookStatus(token: string, options?: { redirectUri?: string }) {
  const query = toQueryString({
    redirect_uri: options?.redirectUri,
  });
  return apiFetch<OutlookStatus>(`/api/email/outlook${query}`, {
    method: "GET",
    token,
  });
}

export function connectOutlookAccount(
  payload: { code: string; state: string; redirectUri?: string },
  token: string,
) {
  const query = toQueryString({
    code: payload.code,
    state: payload.state,
    redirect_uri: payload.redirectUri,
  });
  return apiFetch<OutlookStatus>(`/api/email/outlook/connect${query}`, {
    method: "POST",
    token,
  });
}

export function disconnectOutlookAccount(token: string) {
  return apiFetch<void>("/api/email/outlook", {
    method: "DELETE",
    token,
  });
}
