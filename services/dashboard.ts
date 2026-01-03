import { apiFetch } from "@/lib/api-client";
import type { Client } from "@/types/clients";

export type DisplayAmount = {
  currency: string;
  amount: number;
};

export type CurrencyTotal = {
  usd: number;
  display: DisplayAmount;
};

export type AmountBreakdown = {
  by_currency: {
    currency: string;
    amount: number;
    amount_usd: number;
    display_amount: DisplayAmount;
  }[];
  total_usd: number;
  display_total: DisplayAmount;
};

export type DashboardMetrics = {
  clients_waiting_payment: number;
  total_outstanding: CurrencyTotal;
  total_paid_this_week: CurrencyTotal;
  clients_paid_this_week: number;
};

export type DashboardInvoice = {
  invoice_id: string;
  amount: number;
  amount_usd: number;
  currency: string;
  display_amount: DisplayAmount;
  status: string;
  paid_at?: string | null;
};

export type PaymentStatus = "paid" | "not_paid" | "partially_paid";

export type DashboardClientSummary = {
  client: Client;
  amounts: AmountBreakdown;
  invoices: DashboardInvoice[];
  payment_status?: PaymentStatus;
};

export type DashboardSection = {
  title: string;
  clients: DashboardClientSummary[];
};

export type DashboardSummary = {
  metrics: DashboardMetrics;
  not_paid_clients: DashboardClientSummary[];
  past_clients: DashboardClientSummary[];
  paid_clients: DashboardClientSummary[];
};

export function fetchDashboardSummary(token: string) {
  return apiFetch<DashboardSummary>("/api/dashboard/summary", {
    method: "GET",
    token,
  });
}
