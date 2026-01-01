import { apiFetch, toQueryString } from "@/lib/api-client";
import type { Reminder, ReminderStatus } from "@/types/invoices";
import type { UpcomingReminder } from "@/types/reminders";

export function fetchReminders(
  token: string,
  params: { status?: ReminderStatus; invoice_id?: string } = {},
) {
  const query = toQueryString({
    status: params.status,
    invoice_id: params.invoice_id,
  });
  return apiFetch<Reminder[]>(`/api/reminders${query}`, { token });
}

export function sendReminder(id: string, token: string) {
  return apiFetch<Reminder>(`/api/reminders/${id}/send`, {
    method: "POST",
    token,
  });
}

export function fetchUpcomingReminders(
  token: string,
  params?: { limit?: number }
) {
  const query = params?.limit
    ? toQueryString({ limit: String(params.limit) })
    : "";
  return apiFetch<UpcomingReminder[]>(`/api/reminders/upcoming${query}`, {
    token,
  });
}

export function fetchReminderHistory(
  token: string,
  invoiceId: string,
  params?: { limit?: number }
) {
  const query = toQueryString({
    invoice_id: invoiceId,
    limit: params?.limit ? String(params.limit) : undefined,
  });
  return apiFetch<Reminder[]>(`/api/reminders/history${query}`, { token });
}
