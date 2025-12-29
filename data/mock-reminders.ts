import { ReminderSummaryData } from "@/types/reminders";

export type ReminderDelivery = {
  id: string;
  sentAt: string;
  channel: string;
  subject: string;
  status: string;
  summary: string;
};

export type ReminderRecord = {
  id: string;
  client: string;
  amount: string;
  status: string;
  nextAction: string;
  scheduleMode: string;
  nextSendAt?: string;
  deliveries: ReminderDelivery[];
  summary: ReminderSummaryData;
  platform: string;
  messages: ReminderMessage[];
};

export type ReminderMessage = {
  id: string;
  sender: "client" | "user";
  text: string;
  timestamp: string;
};

const reminderRecords: Record<string, ReminderRecord> = {
  northwind: {
    id: "northwind",
    client: "Northwind Co.",
    amount: "$4,800",
    status: "Queued via Mailgun",
    nextAction: "Send on Apr 12 • 9:00 AM",
    scheduleMode: "Weekly • Mon/Wed/Fri",
    nextSendAt: "2025-04-12T16:00:00.000Z",
    platform: "gmail",
    deliveries: [
      {
        id: "northwind-r1-delivery-2",
        sentAt: "2025-04-08T16:00:00.000Z",
        channel: "Mailgun",
        subject: "Reminder 2 of 5 — Northwind sprint",
        status: "Opened 2h later",
        summary: "Bumped the April sprint invoice with the Stripe link.",
      },
      {
        id: "northwind-r1-delivery-1",
        sentAt: "2025-04-05T16:00:00.000Z",
        channel: "Mailgun",
        subject: "Gentle reminder — April sprint",
        status: "Delivered",
        summary: "Initial nudge using the gentle tone template.",
      },
    ],
    summary: {
      client: {
        name: "Northwind Co.",
        type: "Business",
        businessName: "Northwind Co.",
        amount: "$4,800",
      },
      contact: {
        platform: "mailgun",
        dispatchMode: "assist",
        value: "billing@northwind.co",
      },
      payment: {
        methodTitle: "Stripe hosted invoice",
        variantLabel: "Stripe Link",
        fields: [
          { label: "Link", value: "https://pay.due.so/northwind" },
          { label: "Notes", value: "Link stays active for 7 days after each reminder." },
        ],
      },
      schedule: {
        mode: "weekly",
        data: {
          days: [0, 2, 4],
          time: "09:00",
          maxReminders: 5,
          tones: ["gentle", "firm"],
        },
      },
    },
    messages: [
      {
        id: "northwind-msg-1",
        sender: "client",
        text: "Got the 4/5 reminder—reviewing internally today.",
        timestamp: "2025-04-05T18:10:00.000Z",
      },
      {
        id: "northwind-msg-2",
        sender: "user",
        text: "Thanks for the update. Let me know if anything blocks the transfer.",
        timestamp: "2025-04-05T18:20:00.000Z",
      },
    ],
  },
  arborlane: {
    id: "arborlane",
    client: "Arbor Lane",
    amount: "$2,200",
    status: "Awaiting reply",
    nextAction: "Draft send Apr 11 • 9:30 AM",
    scheduleMode: "Cadence • Every 5 days",
    nextSendAt: "2025-04-11T16:30:00.000Z",
    platform: "gmail",
    deliveries: [
      {
        id: "arborlane-r1-delivery-2",
        sentAt: "2025-04-08T16:30:00.000Z",
        channel: "Gmail",
        subject: "Reminder 2 — Retainer instalment",
        status: "Sent",
        summary: "Followed up with PDF invoice + ACH instructions.",
      },
      {
        id: "arborlane-r1-delivery-1",
        sentAt: "2025-04-03T16:30:00.000Z",
        channel: "Gmail",
        subject: "Kickoff reminder — Retainer instalment",
        status: "Opened in 5m",
        summary: "Shared invoice link and confirmed next cadence.",
      },
    ],
    summary: {
      client: {
        name: "Arbor Lane",
        type: "Business",
        businessName: "Arbor Lane Studio",
        amount: "$2,200",
      },
      contact: {
        platform: "gmail",
        dispatchMode: "assist",
        value: "accounts@arborlane.com",
      },
      payment: {
        methodTitle: "ACH Transfer",
        variantLabel: "Citi Business · Checking",
        fields: [
          { label: "Account", value: "****5421" },
          { label: "Routing", value: "321081669" },
          { label: "Instructions", value: "Reference invoice AL-RET-04 on the transfer memo." },
        ],
      },
      schedule: {
        mode: "cadence",
        data: {
          frequencyDays: 5,
          startDate: "2025-04-05",
          startTime: "09:30",
          maxReminders: 5,
          tones: ["gentle", "firm"],
        },
      },
    },
    messages: [
      {
        id: "arbor-msg-1",
        sender: "user",
        text: "Sharing the retainer reminder with the PDF attached here.",
        timestamp: "2025-04-03T16:32:00.000Z",
      },
      {
        id: "arbor-msg-2",
        sender: "client",
        text: "Received—routing through finance this afternoon.",
        timestamp: "2025-04-03T17:00:00.000Z",
      },
    ],
  },
  edenmiller: {
    id: "edenmiller",
    client: "Eden Miller",
    amount: "$1,250",
    status: "SMS notice queued",
    nextAction: "Send Apr 9 • 10:30 AM",
    scheduleMode: "Weekly • Wednesdays",
    nextSendAt: "2025-04-09T17:30:00.000Z",
    platform: "whatsapp",
    deliveries: [
      {
        id: "eden-r1-delivery-2",
        sentAt: "2025-04-02T17:30:00.000Z",
        channel: "Mailgun",
        subject: "Reminder 2 — Video edits",
        status: "Sent",
        summary: "Referenced Venmo handle and delivery deadline.",
      },
      {
        id: "eden-r1-delivery-1",
        sentAt: "2025-03-26T17:30:00.000Z",
        channel: "Mailgun",
        subject: "Gentle reminder — Video edits",
        status: "Delivered",
        summary: "Sent first note ahead of edit delivery.",
      },
    ],
    summary: {
      client: {
        name: "Eden Miller",
        type: "Individual",
        businessName: "Freelance producer",
        amount: "$1,250",
      },
      contact: {
        platform: "mailgun",
        dispatchMode: "assist",
        value: "eden.miller@email.com",
      },
      payment: {
        methodTitle: "Venmo Handle",
        variantLabel: "Personal",
        fields: [{ label: "Handle", value: "@payeden" }],
      },
      schedule: {
        mode: "weekly",
        data: {
          days: [2],
          time: "10:30",
          maxReminders: 3,
          tones: ["gentle"],
        },
      },
    },
    messages: [
      {
        id: "eden-msg-1",
        sender: "user",
        text: "Reminder that the March edit invoice is ready when you are.",
        timestamp: "2025-04-02T17:30:00.000Z",
      },
      {
        id: "eden-msg-2",
        sender: "client",
        text: "Thanks—will clear this after today's session.",
        timestamp: "2025-04-02T18:02:00.000Z",
      },
      {
        id: "eden-msg-3",
        sender: "user",
        text: "Appreciate it.",
        timestamp: "2025-04-02T18:05:00.000Z",
      },
    ],
  },
  sableworks: {
    id: "sableworks",
    client: "Sable Works",
    amount: "$1,450",
    status: "Paid",
    nextAction: "Sequence closed automatically",
    scheduleMode: "Manual • 3 sends",
    platform: "gmail",
    deliveries: [
      {
        id: "sable-r1-delivery-3",
        sentAt: "2025-03-20T17:00:00.000Z",
        channel: "Mailgun",
        subject: "Reminder 3 — Maintenance retainer",
        status: "Paid after send",
        summary: "Final note referencing invoice SW-0318.",
      },
      {
        id: "sable-r1-delivery-2",
        sentAt: "2025-03-19T17:00:00.000Z",
        channel: "Mailgun",
        subject: "Reminder 2 — Maintenance retainer",
        status: "Sent",
        summary: "Firm tone citing overdue amount.",
      },
      {
        id: "sable-r1-delivery-1",
        sentAt: "2025-03-18T17:00:00.000Z",
        channel: "Mailgun",
        subject: "Gentle reminder — Maintenance retainer",
        status: "Sent",
        summary: "Sent with Cash App instructions.",
      },
    ],
    summary: {
      client: {
        name: "Sable Works",
        type: "Business",
        businessName: "Sable Works",
        amount: "$1,450",
      },
      contact: {
        platform: "mailgun",
        dispatchMode: "assist",
        value: "hello@sableworks.io",
      },
      payment: {
        methodTitle: "Cash App",
        variantLabel: "Handle",
        fields: [
          { label: "Handle", value: "@sableworks" },
          {
            label: "Instructions",
            value: "Send as goods & services to auto-close the reminder.",
          },
        ],
      },
      schedule: {
        mode: "manual",
        data: {
          entries: [
            { date: "2025-03-18", time: "10:00", tone: "gentle" },
            { date: "2025-03-19", time: "10:00", tone: "firm" },
            { date: "2025-03-20", time: "10:00", tone: "firm" },
          ],
        },
      },
    },
    messages: [
      {
        id: "sable-msg-1",
        sender: "client",
        text: "Paid via Cash App a few minutes ago.",
        timestamp: "2025-03-20T18:05:00.000Z",
      },
      {
        id: "sable-msg-2",
        sender: "user",
        text: "Confirmed receipt—thanks for the quick turnaround.",
        timestamp: "2025-03-20T18:10:00.000Z",
      },
    ],
  },
};

const reminderToTimestamp = (iso?: string) => {
  if (!iso) {
    return Number.MAX_SAFE_INTEGER;
  }
  return new Date(iso).getTime();
};

export const upcomingReminders = Object.values(reminderRecords)
  .filter((reminder) => reminder.nextSendAt)
  .sort((a, b) => {
    const aTime = reminderToTimestamp(a.nextSendAt);
    const bTime = reminderToTimestamp(b.nextSendAt);
    return aTime - bTime;
  });

export type ReminderDraft = {
  id: string;
  client: string;
  amount: string;
  status: string;
  next: string;
};

export const reminderDrafts: ReminderDraft[] = [
  {
    id: "cascade",
    client: "Cascade Labs",
    amount: "$3,200",
    status: "Draft",
    next: "Waiting for send instructions",
  },
  {
    id: "everest",
    client: "Everest Studio",
    amount: "$1,900",
    status: "Draft",
    next: "Tone and schedule pending",
  },
];

export const reminderDetails = reminderRecords;
