export type ReminderScheduleManualSummary = {
  mode: "manual";
  data?: {
    entries?: Array<{ date: string; time: string; tone: string }>;
  };
};

export type ReminderScheduleWeeklySummary = {
  mode: "weekly";
  data?: {
    days?: number[];
    time?: string;
    maxReminders?: number;
    tones?: string[];
  };
};

export type ReminderScheduleCadenceSummary = {
  mode: "cadence";
  data?: {
    frequencyDays?: number;
    startDate?: string;
    startTime?: string;
    maxReminders?: number;
    tones?: string[];
  };
};

import type {
  DeliveryChannel,
  ReminderSchedulePayload,
  ReminderStatus,
  ReminderTone,
} from "./invoices";

export type ReminderScheduleSummary =
  | ReminderScheduleManualSummary
  | ReminderScheduleWeeklySummary
  | ReminderScheduleCadenceSummary;

export type ReminderSummaryPaymentField = {
  label: string;
  value: string;
};

export type ReminderSummaryPayment = {
  methodTitle?: string;
  variantLabel?: string;
  fields?: ReminderSummaryPaymentField[];
} | null;

export type ReminderSummaryData = {
  client: {
    name: string;
    type: string;
    businessName?: string;
    amount: string;
    currency?: string;
    dueDate?: string;
  };
  contact: {
    platform: string;
    dispatchMode: "self" | "assist";
    value: string;
  };
  payment: ReminderSummaryPayment;
  schedule: ReminderScheduleSummary;
  timezone?: string;
};

export type UpcomingReminder = {
  id: string;
  invoice_id: string;
  client_id: string;
  user_id: string;
  scheduled_for: string;
  tone: ReminderTone;
  status: ReminderStatus;
  delivery_channel: DeliveryChannel | null;
  sent_at: string | null;
  last_error: string | null;
  client_name: string;
  invoice_amount: number;
  invoice_currency: string;
  invoice_send_via: DeliveryChannel;
  invoice_schedule: ReminderSchedulePayload;
};
