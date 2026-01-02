import type { Client } from "@/types/clients";
import type { ContactMethod } from "@/types/clients";
import type {
  DeliveryChannel,
  Invoice,
  ReminderSchedulePayload,
} from "@/types/invoices";
import type {
  ReminderScheduleSummary,
  ReminderSummaryData,
  ReminderSummaryPayment,
  ReminderSummaryPaymentField,
} from "@/types/reminders";
import type {
  PaymentMethodDetails,
  PaymentMethodType,
} from "@/types/payment-methods";
import { formatCurrency } from "@/lib/dashboard-clients";

export function buildReminderSummaryFromResources({
  invoice,
  client,
}: {
  invoice: Invoice;
  client?: Client | null;
}): ReminderSummaryData {
  const contactMethod = invoice.contact_method as ContactMethod | undefined;
  return {
    client: {
      name: client?.name ?? contactMethod?.label ?? "Client",
      type: formatClientType(client?.client_type ?? "business"),
      businessName: client?.company_name ?? undefined,
      amount: formatCurrency(invoice.amount, invoice.currency),
      currency: invoice.currency,
      dueDate: invoice.due_date ?? undefined,
    },
    contact: {
      platform: invoice.send_via,
      dispatchMode: "assist",
      value: contactValue(contactMethod) ?? client?.email ?? "—",
    },
    payment: buildPaymentSummary(invoice.payment_instructions?.[0]),
    schedule: convertScheduleSummary(invoice.reminder_schedule),
  };
}

function formatClientType(value: Client["client_type"]) {
  return value === "business" ? "Business" : "Individual";
}

function contactValue(method?: ContactMethod) {
  if (!method) return null;
  if (method.email) return method.email;
  if (method.phone) return method.phone;
  if (method.telegram_username) return method.telegram_username;
  if (method.telegram_chat_id) return method.telegram_chat_id;
  if (method.slack_user_id) return method.slack_user_id;
  return method.label || null;
}

function buildPaymentSummary(
  instruction?: PaymentMethodDetails
): ReminderSummaryPayment {
  if (!instruction) return null;
  const methodTitle =
    instruction.label ?? formatPaymentTypeLabel(instruction.type);
  const variantLabel = instruction.label
    ? formatPaymentTypeLabel(instruction.type)
    : undefined;
  const fields: ReminderSummaryPaymentField[] = [];

  pushField(fields, "Instructions", instruction.instructions ?? "");

  switch (instruction.type) {
    case "stripe_link":
    case "paypal_link":
    case "venmo_link":
    case "cashapp_link":
    case "revolut_link":
    case "wise_link":
      pushField(fields, "Payment link", instruction.url);
      break;
    case "paypal_handle":
    case "venmo_handle":
    case "cashapp_handle":
      pushField(fields, "Handle", instruction.handle);
      break;
    case "ach":
      pushField(fields, "Bank", instruction.ach_bank_name);
      pushField(fields, "Account", instruction.ach_account_number);
      pushField(fields, "Routing number", instruction.ach_routing_number);
      pushField(fields, "Account type", instruction.ach_account_type);
      break;
    case "zelle":
      pushField(fields, "Email", instruction.zelle_email);
      pushField(fields, "Phone", instruction.zelle_phone);
      break;
    case "sepa":
      pushField(fields, "IBAN", instruction.iban);
      pushField(fields, "BIC", instruction.bic);
      break;
    case "revolut_account":
    case "wise_account":
    case "n26_account":
      pushField(fields, "IBAN", instruction.iban);
      pushField(fields, "BIC", instruction.bic);
      break;
    default:
      pushField(fields, "Details", instruction.label);
      break;
  }

  return {
    methodTitle,
    variantLabel,
    fields: fields.filter((field) => Boolean(field.value)),
  };
}

function convertScheduleSummary(
  schedule?: ReminderSchedulePayload
): ReminderScheduleSummary {
  if (!schedule) {
    return {
      mode: "manual",
      data: { entries: [] },
    };
  }
  if (schedule.mode === "manual") {
    const entries =
      schedule.manual_dates?.map((iso, index) => {
        const dateObj = new Date(iso);
        return {
          date: Number.isNaN(dateObj.getTime()) ? iso : dateObj.toISOString(),
          time: formatTimeFromISO(dateObj),
          tone: schedule.tone_sequence?.[index % schedule.tone_sequence.length] ?? "neutral",
        };
      }) ?? [];
    return {
      mode: "manual",
      data: { entries },
    };
  }
  if (schedule.mode === "weekly") {
    return {
      mode: "weekly",
      data: {
        days: schedule.weekly_pattern.weekdays,
        time: schedule.weekly_pattern.time_of_day,
        maxReminders: schedule.weekly_pattern.max_reminders,
        tones: schedule.tone_sequence,
      },
    };
  }
  return {
    mode: "cadence",
    data: {
      frequencyDays: schedule.cadence.frequency_days,
      startDate: schedule.cadence.start_date ?? undefined,
      startTime: schedule.cadence.start_time ?? undefined,
      maxReminders: schedule.cadence.max_reminders,
      tones: schedule.tone_sequence,
    },
  };
}

function pushField(
  fields: ReminderSummaryPaymentField[],
  label: string,
  value?: string | null
) {
  if (!value) return;
  fields.push({ label, value });
}

function formatPaymentTypeLabel(type: PaymentMethodType) {
  if (type.startsWith("crypto_")) {
    return type.replace("crypto_", "").toUpperCase() + " wallet";
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTimeFromISO(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
