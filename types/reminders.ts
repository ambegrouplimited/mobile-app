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
    dueDate?: string;
  };
  contact: {
    platform: string;
    dispatchMode: "self" | "assist";
    value: string;
  };
  payment: ReminderSummaryPayment;
  schedule: ReminderScheduleSummary;
};
