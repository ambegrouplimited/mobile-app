import { apiFetch } from "@/lib/api-client";
import type {
  ReminderDraft,
  ReminderDraftCreatePayload,
  ReminderDraftUpdatePayload,
} from "@/types/reminder-drafts";

export function fetchReminderDrafts(token: string) {
  return apiFetch<ReminderDraft[]>("/api/reminder-drafts", { token });
}

export function fetchReminderDraft(id: string, token: string) {
  return apiFetch<ReminderDraft>(`/api/reminder-drafts/${id}`, { token });
}

export function createReminderDraft(payload: ReminderDraftCreatePayload, token: string) {
  return apiFetch<ReminderDraft>("/api/reminder-drafts", {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateReminderDraft(id: string, payload: ReminderDraftUpdatePayload, token: string) {
  return apiFetch<ReminderDraft>(`/api/reminder-drafts/${id}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deleteReminderDraft(id: string, token: string) {
  return apiFetch<void>(`/api/reminder-drafts/${id}`, {
    method: "DELETE",
    token,
  });
}
