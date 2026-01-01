import { apiFetch } from "@/lib/api-client";
import type { SessionInfo } from "@/types/security";

export function fetchSessions(token: string) {
  return apiFetch<SessionInfo[]>("/api/security/sessions", {
    token,
  });
}

export function revokeSession(sessionId: string, token: string) {
  return apiFetch<void>(`/api/security/sessions/${sessionId}`, {
    method: "DELETE",
    token,
  });
}
