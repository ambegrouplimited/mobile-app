import type {
  ReminderScheduleMode,
  ReminderSchedulePayload,
  ReminderTone,
} from "@/types/invoices";

export type ManualScheduleSummaryEntry = {
  date: string;
  time: string;
  tone: ReminderTone;
};

export type ManualScheduleSummary = {
  entries: ManualScheduleSummaryEntry[];
};

export type WeeklyScheduleSummary = {
  days: number[];
  time: string;
  maxReminders?: number;
  tones: ReminderTone[];
};

export type CadenceScheduleSummary = {
  frequencyDays: number;
  startDate?: string | null;
  startTime: string;
  maxReminders?: number;
  tones: ReminderTone[];
};

export type ReminderScheduleSummaryMap = {
  manual: ManualScheduleSummary;
  weekly: WeeklyScheduleSummary;
  cadence: CadenceScheduleSummary;
};

export type ReminderScheduleSummaryValue<M extends ReminderScheduleMode = ReminderScheduleMode> =
  ReminderScheduleSummaryMap[M];

export type ScheduleSummaryResult =
  | { mode: "manual"; summary: ManualScheduleSummary }
  | { mode: "weekly"; summary: WeeklyScheduleSummary }
  | { mode: "cadence"; summary: CadenceScheduleSummary };

export function buildSchedulePayload<M extends ReminderScheduleMode>(
  mode: M,
  rawData: ReminderScheduleSummaryValue<M> | null | undefined,
): ReminderSchedulePayload | null {
  if (!rawData) {
    return null;
  }
  if (mode === "manual") {
    const entries = rawData.entries ?? [];
    if (!entries.length) {
      return null;
    }
    return {
      mode: "manual",
      manual_dates: entries.map((entry) => toDateTime(entry.date, entry.time)),
      tone_sequence: entries.map((entry) => entry.tone ?? "gentle"),
      max_reminders: entries.length,
    };
  }
  if (mode === "weekly") {
    return {
      mode: "weekly",
      weekly_pattern: {
        weekdays: Array.isArray(rawData.days) ? rawData.days : [],
        time_of_day: toTimeOfDay(rawData.time),
      },
      tone_sequence: rawData.tones ?? [],
      max_reminders: toNumberValue(rawData.maxReminders),
    };
  }
  return {
    mode: "cadence",
    cadence: {
      frequency_days: toNumberValue((rawData as CadenceScheduleSummary).frequencyDays) ?? 0,
      start_date: (rawData as CadenceScheduleSummary).startDate ?? null,
      start_time: (rawData as CadenceScheduleSummary).startTime
        ? toTimeOfDay((rawData as CadenceScheduleSummary).startTime)
        : null,
    },
    tone_sequence: (rawData as CadenceScheduleSummary).tones ?? [],
    max_reminders: toNumberValue((rawData as CadenceScheduleSummary).maxReminders),
  };
}

export function schedulePayloadToSummary(schedule: ReminderSchedulePayload): ScheduleSummaryResult {
  if (schedule.mode === "manual") {
    const tones = schedule.tone_sequence ?? [];
    const entries = (schedule.manual_dates ?? []).map((value, index) => {
      const date = new Date(value);
      const tone =
        tones[index] ?? (tones.length ? tones[index % tones.length] : undefined) ?? ("gentle" as ReminderTone);
      return {
        date: date.toISOString().slice(0, 10),
        time: date.toISOString().slice(11, 16),
        tone,
      };
    });
    return {
      mode: "manual",
      summary: { entries },
    };
  }
  if (schedule.mode === "weekly") {
    return {
      mode: "weekly",
      summary: {
        days: schedule.weekly_pattern?.weekdays ?? [],
        time: trimTime(schedule.weekly_pattern?.time_of_day ?? "09:00"),
        maxReminders: schedule.max_reminders,
        tones: schedule.tone_sequence ?? [],
      },
    };
  }
  return {
    mode: "cadence",
    summary: {
      frequencyDays: schedule.cadence?.frequency_days ?? 1,
      startDate: schedule.cadence?.start_date ?? null,
      startTime: trimTime(schedule.cadence?.start_time ?? "09:00"),
      maxReminders: schedule.max_reminders,
      tones: schedule.tone_sequence ?? [],
    },
  };
}

function toDateTime(date: string, time: string) {
  if (!date) {
    return new Date().toISOString();
  }
  const safeTime = time && time.includes(":") ? time : "09:00";
  const iso = new Date(`${date}T${safeTime}:00`);
  return iso.toISOString();
}

function toTimeOfDay(value?: string | null) {
  if (!value) {
    return "09:00:00";
  }
  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return `${value}:00`;
}

function toNumberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function trimTime(value: string) {
  if (!value) return "09:00";
  if (value.includes(":")) {
    return value.slice(0, 5);
  }
  return value;
}
