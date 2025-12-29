import { apiFetch } from "@/lib/api-client";

export function connectChannel(id: string, token: string) {
  return apiFetch(`/api/channels/${id}/connect`, {
    method: "POST",
    token,
  });
}

export function disconnectChannel(id: string, token: string) {
  return apiFetch(`/api/channels/${id}/disconnect`, {
    method: "POST",
    token,
  });
}
