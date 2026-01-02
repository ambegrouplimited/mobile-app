import type { ContactMethod } from "./clients";
import type { PaymentMethodDetails } from "./payment-methods";

export type DeliveryChannel = "mailgun" | "gmail" | "outlook" | "whatsapp" | "telegram" | "slack" | "auto";
export type ReminderTone = "gentle" | "neutral" | "firm";
export type ReminderStatus = "pending" | "queued" | "sending" | "sent" | "skipped" | "failed";
export type InvoiceStatus = "draft" | "active" | "paid" | "paused" | "overdue";

export type ReminderScheduleMode = "manual" | "weekly" | "cadence";

export type ReminderScheduleManual = {
  mode: "manual";
  manual_dates: string[];
  tone_sequence: ReminderTone[];
  max_reminders?: number;
};

export type ReminderScheduleWeekly = {
  mode: "weekly";
  weekly_pattern: {
    weekdays: number[];
    time_of_day: string;
  };
  tone_sequence: ReminderTone[];
  max_reminders?: number;
};

export type ReminderScheduleCadence = {
  mode: "cadence";
  cadence: {
    frequency_days: number;
    start_date?: string | null;
    start_time?: string | null;
  };
  tone_sequence: ReminderTone[];
  max_reminders?: number;
};

export type ReminderSchedulePayload =
  | ReminderScheduleManual
  | ReminderScheduleWeekly
  | ReminderScheduleCadence;

export type Invoice = {
  id: string;
  user_id: string;
  client_id: string;
  amount: number;
  amount_usd?: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  send_via: DeliveryChannel;
  timezone?: string | null;
  contact_method_id: string;
  contact_method: ContactMethod;
  reminder_schedule: ReminderSchedulePayload;
  payment_instructions: PaymentMethodDetails[];
  stripe_invoice_url: string | null;
  paypal_invoice_url: string | null;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
};

export type InvoiceCreatePayload = {
  client_id: string;
  contact_method_id?: string;
  amount: number;
  currency: string;
  description?: string | null;
  due_date?: string | null;
  send_via: DeliveryChannel;
  timezone?: string | null;
  reminder_schedule: ReminderSchedulePayload;
  payment_method_ids?: string[];
  custom_payment_methods?: Record<string, unknown>[];
  sync_to_stripe?: boolean;
  sync_to_paypal?: boolean;
};

export type InvoiceUpdatePayload = Partial<InvoiceCreatePayload>;

export type Reminder = {
  id: string;
  invoice_id: string;
  client_id: string;
  user_id: string;
  scheduled_for: string;
  tone: ReminderTone;
  status: ReminderStatus;
  sent_at: string | null;
  last_error: string | null;
};
