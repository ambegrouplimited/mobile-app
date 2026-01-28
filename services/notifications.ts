import { apiFetch } from "@/lib/api-client";

export function registerPushToken(payload: { token: string }, authToken: string) {
  return apiFetch<void>("/api/notifications/token", {
    method: "POST",
    body: payload,
    token: authToken,
  });
}

export function deletePushToken(token: string, authToken: string) {
  const encoded = encodeURIComponent(token);
  return apiFetch<void>(`/api/notifications/token/${encoded}`, {
    method: "DELETE",
    token: authToken,
  });
}
