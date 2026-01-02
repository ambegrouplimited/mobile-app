import type { ClientAmountOption, ClientListItem } from "@/data/mock-clients";
import { resolveFractionDigits } from "@/lib/currency";
import type {
  AmountBreakdown,
  DashboardClientSummary,
  DashboardPaidClient,
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
  const { client, total_amount } = entry;
  const amountOptions = buildAmountOptions(entry.amounts, total_amount);
  const displayAmount = amountOptions[0];
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(total_amount, "USD"),
    status: "Not Paid",
    detail: "Awaiting payment",
    client_type: client.client_type,
    amount_options: amountOptions,
  };
}

export function buildPastClientRow(
  entry: DashboardClientSummary,
): ClientListItem {
  const { client, total_amount } = entry;
  const paymentStatus = entry.payment_status ?? "paid";
  const statusMeta = PAST_CLIENT_STATUS_META[paymentStatus];
  const amountOptions = buildAmountOptions(entry.amounts, total_amount);
  const displayAmount = amountOptions[0];
  return {
    id: client.id,
    name: truncateName(client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(total_amount, "USD"),
    status: statusMeta.status,
    detail: statusMeta.detail,
    client_type: client.client_type,
    amount_options: amountOptions,
  };
}

export function buildPaidClientRow(
  entry: DashboardPaidClient
): ClientListItem {
  const latestPaid = entry.invoices
    .map((invoice) => invoice.paid_at)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const detail = `${entry.invoices.length} invoice${
    entry.invoices.length === 1 ? "" : "s"
  } · ${
    latestPaid ? `Paid ${formatDateShort(latestPaid)}` : "Settled this week"
  }`;
  const amountOptions = buildAmountOptions(entry.amounts, entry.total_paid);
  const displayAmount = amountOptions[0];
  return {
    id: entry.client.id,
    name: truncateName(entry.client.name),
    amount: displayAmount
      ? formatCurrency(displayAmount.amount, displayAmount.currency)
      : formatCurrency(entry.total_paid, "USD"),
    status: "Paid",
    detail,
    client_type: entry.client.client_type,
    amount_options: amountOptions,
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
