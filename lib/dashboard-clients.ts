import type { ClientAmountOption, ClientListItem } from "@/data/mock-clients";
import { resolveFractionDigits } from "@/lib/currency";
import type {
  AmountBreakdown,
  DashboardClientSummary,
  DashboardInvoice,
  PaymentStatus,
} from "@/services/dashboard";

export type CurrencyDisplayMode = "display" | "usd";

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
  entry: DashboardClientSummary,
): ClientListItem {
  const { client } = entry;
  const fallbackAmount =
    entry.amounts?.display_total?.amount ?? entry.amounts?.total_usd ?? 0;
  const amountOptions = buildAmountOptions(entry.amounts, fallbackAmount);
  const displayAmount = amountOptions[0];
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(fallbackAmount, "USD"),
    status: "Not Paid",
    detail: "Awaiting payment",
    client_type: client.client_type,
    amount_options: amountOptions,
    meta: {
      invoiceIds: entry.invoices?.map((invoice) => invoice.invoice_id),
    },
  };
}

export function buildPastClientRow(
  entry: DashboardClientSummary,
): ClientListItem {
  const { client } = entry;
  const paymentStatus = resolvePastPaymentStatus(entry);
  const statusMeta = PAST_CLIENT_STATUS_META[paymentStatus];
  const fallbackAmount =
    entry.amounts?.display_total?.amount ?? entry.amounts?.total_usd ?? 0;
  const amountOptions = buildAmountOptions(entry.amounts, fallbackAmount);
  const displayAmount = amountOptions[0];
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(fallbackAmount, "USD"),
    status: statusMeta.status,
    detail: statusMeta.detail,
    client_type: client.client_type,
    amount_options: amountOptions,
    meta: {
      invoiceIds: entry.invoices?.map((invoice) => invoice.invoice_id),
    },
  };
}

export function buildPaidClientRow(
  entry: DashboardClientSummary
): ClientListItem {
  const latestPaid = entry.invoices
    .map((invoice) => invoice.paid_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const invoiceCount = entry.invoices?.length ?? 0;
  const detail = `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}${
    latestPaid ? ` · Paid ${formatDateShort(latestPaid)}` : ""
  }`;
  const total = entry.amounts?.display_total?.amount ?? entry.amounts?.total_usd ?? 0;
  const amountOptions = buildAmountOptions(entry.amounts, total);
  const displayAmount = amountOptions[0];
  return {
    id: entry.client.id,
    name: truncateName(entry.client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(total, "USD"),
    status: "Paid",
    detail,
    client_type: entry.client.client_type,
    amount_options: amountOptions,
    meta: {
      invoiceIds: entry.invoices?.map((invoice) => invoice.invoice_id),
    },
  };
}

export function formatCurrency(
  value: number,
  currency = "USD",
  options?: { defaultMaxDigits?: number; maxDigits?: number }
) {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "—";
  }
  const maximumFractionDigits = resolveFractionDigits(
    amount,
    options?.defaultMaxDigits ?? 2,
    options?.maxDigits
  );
  if (typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits,
      }).format(amount);
    } catch {
      // Fall through to manual formatting below.
    }
  }
  const fallback = amount.toFixed(maximumFractionDigits);
  return `${currency.toUpperCase()} ${fallback}`;
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

function resolvePastPaymentStatus(
  entry: DashboardClientSummary,
): PaymentStatus {
  if (entry.payment_status) {
    return entry.payment_status;
  }
  return determineStatusFromInvoices(entry.invoices);
}

function determineStatusFromInvoices(
  invoices?: DashboardInvoice[],
): PaymentStatus {
  if (!invoices?.length) {
    return "paid";
  }
  let hasPaid = false;
  let hasUnpaid = false;
  for (const invoice of invoices) {
    if (invoice.status === "paid") {
      hasPaid = true;
    } else {
      hasUnpaid = true;
    }
    if (hasPaid && hasUnpaid) {
      return "partially_paid";
    }
  }
  if (hasUnpaid) {
    return "not_paid";
  }
  return "paid";
}

function buildAmountOptions(
  amounts?: AmountBreakdown,
  fallbackAmount?: number
): ClientAmountOption[] {
  const options: ClientAmountOption[] = [];
  if (amounts?.by_currency?.length) {
    const primary = selectPrimaryCurrency(amounts.by_currency);
    if (primary) {
      options.push({
        id: `currency:${primary.currency.toUpperCase()}`,
        label: primary.currency.toUpperCase(),
        currency: primary.currency.toUpperCase(),
        amount: primary.amount,
      });
    }
  }

  const display = amounts?.display_total;
  if (display) {
    const displayCurrency = display.currency?.toUpperCase() ?? "USD";
    if (!options.find((option) => option.currency === displayCurrency)) {
      options.push({
        id: `display:${displayCurrency}`,
        label: displayCurrency,
        currency: displayCurrency,
        amount: display.amount,
      });
    }
  }

  const usdAmount =
    typeof amounts?.total_usd === "number"
      ? amounts.total_usd
      : typeof fallbackAmount === "number"
      ? fallbackAmount
      : undefined;
  if (typeof usdAmount === "number") {
    if (!options.find((option) => option.currency === "USD")) {
      options.push({
        id: "usd",
        label: "USD",
        currency: "USD",
        amount: usdAmount,
      });
    }
  }

  if (!options.length && typeof fallbackAmount === "number") {
    options.push({
      id: "fallback",
      label: "USD",
      currency: "USD",
      amount: fallbackAmount,
    });
  }

  return options;
}

function selectPrimaryCurrency(
  entries: AmountBreakdown["by_currency"]
): AmountBreakdown["by_currency"][number] | null {
  if (!entries?.length) return null;
  return [...entries].sort(
    (a, b) => (b.amount_usd ?? b.amount) - (a.amount_usd ?? a.amount)
  )[0];
}
