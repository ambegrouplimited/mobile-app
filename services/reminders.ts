import { apiFetch, toQueryString } from "@/lib/api-client";
import type { Reminder, ReminderStatus } from "@/types/invoices";

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
