import { apiFetch } from "@/lib/api-client";
import type { Client } from "@/types/clients";

export type DashboardMetrics = {
  clients_waiting_payment: number;
  total_outstanding: number;
  total_paid_this_week: number;
  clients_paid_this_week: number;
};

export type DashboardPaidInvoice = {
  invoice_id: string;
  amount: number;
  currency: string;
  paid_at: string;
};

export type PaymentStatus = "paid" | "not_paid" | "partially_paid";

export type DashboardClientSummary = {
  client: Client;
  total_amount: number;
  payment_status?: PaymentStatus;
};

export type DashboardPaidClient = {
  client: Client;
  total_paid: number;
  invoices: DashboardPaidInvoice[];
};

export type DashboardSummary = {
  metrics: DashboardMetrics;
  active_clients: DashboardClientSummary[];
  past_clients: DashboardClientSummary[];
  paid_clients_this_week: DashboardPaidClient[];
};

export function fetchDashboardSummary(token: string) {
  return apiFetch<DashboardSummary>("/api/dashboard/summary", {
    method: "GET",
    token,
  });
}
