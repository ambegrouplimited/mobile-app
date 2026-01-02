import { apiFetch, toQueryString } from "@/lib/api-client";
import type { Invoice, InvoiceCreatePayload, InvoiceUpdatePayload, ReminderSchedulePayload } from "@/types/invoices";

export function fetchInvoices(token: string, params?: { status?: string; client_id?: string }) {
  const query = params ? toQueryString(params) : "";
  return apiFetch<Invoice[]>(`/api/invoices${query}`, { token });
}

export function fetchInvoice(id: string, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}`, { token });
}

export function createInvoice(payload: InvoiceCreatePayload, token: string) {
  return apiFetch<Invoice>("/api/invoices", {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateInvoice(id: string, payload: InvoiceUpdatePayload, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function markInvoicePaid(id: string, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/mark-paid`, {
    method: "POST",
    token,
  });
}

export function markInvoiceUnpaid(id: string, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/mark-unpaid`, {
    method: "POST",
    token,
  });
}

export function pauseInvoice(id: string, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/pause`, {
    method: "POST",
    token,
  });
}

export function resumeInvoice(id: string, token: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/resume`, {
    method: "POST",
    token,
  });
}

export function rescheduleInvoice(id: string, schedule: ReminderSchedulePayload, token: string, timezone?: string) {
  return apiFetch<Invoice>(`/api/invoices/${id}/reschedule`, {
    method: "POST",
    body: {
      reminder_schedule: schedule,
      ...(timezone ? { timezone } : {}),
    },
    token,
  });
}
