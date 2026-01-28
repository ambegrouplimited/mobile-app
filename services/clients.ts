import { apiFetch } from "@/lib/api-client";
import type { Client, ClientCreatePayload, ClientUpdatePayload } from "@/types/clients";

export function fetchClients(token: string) {
  return apiFetch<Client[]>("/api/clients", { token });
}

export function fetchClient(id: string, token: string) {
  return apiFetch<Client>(`/api/clients/${id}`, { token });
}

export function createClient(payload: ClientCreatePayload, token: string) {
  return apiFetch<Client>("/api/clients", {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateClient(id: string, payload: ClientUpdatePayload, token: string) {
  return apiFetch<Client>(`/api/clients/${id}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deleteClient(id: string, token: string) {
  return apiFetch<void>(`/api/clients/${id}`, {
    method: "DELETE",
    token,
  });
}
