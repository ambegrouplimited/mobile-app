import type { ClientListItem } from "@/data/mock-clients";
import type {
  DashboardClientSummary,
  DashboardPaidClient,
  PaymentStatus,
} from "@/services/dashboard";

export const PAST_CLIENT_STATUS_META: Record<
  PaymentStatus,
  { status: ClientListItem["status"]; detail: string }
> = {
  paid: {
    status: "Paid",
    detail: "All invoices settled",
  },
  not_paid: {
    status: "Not Paid",
    detail: "Awaiting first payment",
  },
  partially_paid: {
    status: "Partially Paid",
    detail: "Mix of paid and outstanding invoices",
  },
};

export function buildOutstandingClientRow(
  entry: DashboardClientSummary
): ClientListItem {
  const { client, total_amount } = entry;
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: formatCurrency(total_amount, "USD"),
    status: "Not Paid",
    detail: "Awaiting payment",
    client_type: client.client_type,
  };
}

export function buildPastClientRow(
  entry: DashboardClientSummary
): ClientListItem {
  const { client, total_amount } = entry;
  const paymentStatus = entry.payment_status ?? "paid";
  const statusMeta = PAST_CLIENT_STATUS_META[paymentStatus];
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: formatCurrency(total_amount, "USD"),
    status: statusMeta.status,
    detail: statusMeta.detail,
    client_type: client.client_type,
  };
}

export function buildPaidClientRow(entry: DashboardPaidClient): ClientListItem {
  const latestPaid = entry.invoices
    .map((invoice) => invoice.paid_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const detail = `${entry.invoices.length} invoice${
    entry.invoices.length === 1 ? "" : "s"
  } · ${
    latestPaid ? `Paid ${formatDateShort(latestPaid)}` : "Settled this week"
  }`;
  const currency = entry.invoices[0]?.currency ?? "USD";
  return {
    id: entry.client.id,
    name: truncateName(entry.client.name),
    amount: formatCurrency(entry.total_paid, currency),
    status: "Paid",
    detail,
    client_type: entry.client.client_type,
  };
}

export function formatCurrency(value: number, currency = "USD") {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function truncateName(name: string) {
  if (name.length <= 14) return name;
  return `${name.slice(0, 11)}…`;
}

function formatDateShort(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
