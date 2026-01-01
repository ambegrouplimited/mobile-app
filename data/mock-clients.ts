export type ClientStatus = "Paid" | "Not Paid" | "Partially Paid";

export type ClientType = "business" | "individual";

export type ClientListItem = {
  id: string;
  name: string;
  amount: string;
  status: ClientStatus;
  detail: string;
  client_type: ClientType;
};

export const activeClients: ClientListItem[] = [
  { id: "northwind", name: "Northwind Co.", amount: "$4,800", status: "Not Paid", detail: "Due in 3 days", client_type: "business" },
  { id: "arborlane", name: "Arbor Lane", amount: "$2,200", status: "Not Paid", detail: "Sent yesterday • Gmail", client_type: "business" },
  { id: "sableworks", name: "Sable Works", amount: "$1,450", status: "Paid", detail: "Stripe invoice settled", client_type: "business" },
  { id: "brightlabs", name: "Bright Labs", amount: "$2,980", status: "Paid", detail: "Bank transfer received", client_type: "business" },
  { id: "edenmiller", name: "Eden Miller", amount: "$1,250", status: "Not Paid", detail: "Reminder queued for Wed", client_type: "individual" },
];

export const pastClients: ClientListItem[] = [
  { id: "atlas", name: "Atlas Group", amount: "$3,600", status: "Paid", detail: "Paid last week", client_type: "business" },
  { id: "fjord", name: "Fjord Consulting", amount: "$2,150", status: "Paid", detail: "Paid 2 weeks ago", client_type: "business" },
];

export type ReminderSchedule =
  | {
    mode: "manual";
    manual_dates: string[];
    tone_sequence: string[];
  }
  | {
    mode: "weekly";
    weekly_pattern: {
      weekdays: number[];
      time_of_day: string;
      max_reminders?: number;
    };
    tone_sequence: string[];
  }
  | {
    mode: "cadence";
    cadence: {
      frequency_days: number;
      start_date?: string;
      start_time: string;
      max_reminders: number;
    };
    tone_sequence: string[];
  };

export type PaymentMethod =
  | {
    kind: "stripe_link" | "paypal_link" | "venmo_link" | "cashapp_link" | "revolut_link" | "wise_link";
    url: string;
    label?: string;
    instructions?: string;
  }
  | {
    kind: "paypal_handle" | "venmo_handle" | "cashapp_handle";
    handle: string;
    label?: string;
    instructions?: string;
  }
  | {
    kind: "ach";
    ach_bank_name: string;
    ach_account_number: string;
    ach_routing_number: string;
    ach_account_type?: string;
    instructions?: string;
  }
  | {
    kind: "zelle";
    zelle_email?: string;
    zelle_phone?: string;
    label?: string;
    instructions?: string;
  }
  | {
    kind: "sepa";
    iban: string;
    bic?: string;
    label?: string;
    instructions?: string;
  }
  | {
    kind: "revolut_account" | "wise_account" | "n26_account";
    iban: string;
    bic: string;
    label?: string;
    instructions?: string;
  };

export type ReminderItem = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  due_date: string;
  reminder_schedule: ReminderSchedule;
  send_via: string;
  status: string;
  created_at: string;
  payment_method: PaymentMethod;
};

export type ClientProfile = {
  client: {
    id: string;
    name: string;
    email: string;
    company_name: string;
    phone: string;
    notes: string;
    created_at: string;
    updated_at: string;
    client_type: ClientType;
  };
  reminders: ReminderItem[];
};

export const clientProfiles: Record<string, ClientProfile> = {
  northwind: {
    client: {
      id: "northwind",
    name: "Northwind Co.",
    email: "billing@northwind.co",
    company_name: "Northwind Co.",
    phone: "+1 (415) 555-9292",
    notes: "Product design retainer. Prefers Monday reminders at 9am.",
    created_at: "2025-01-02T08:45:00.000Z",
    updated_at: "2025-03-10T12:30:00.000Z",
    client_type: "business",
  },
    reminders: [
      {
        id: "northwind-r1",
        amount: 4800,
        currency: "USD",
        description: "April product design sprint",
        due_date: "2025-04-15T00:00:00.000Z",
        reminder_schedule: {
          mode: "weekly",
          weekly_pattern: {
            weekdays: [0, 2, 4],
            max_reminders: 5,
            time_of_day: "09:00:00",

          },
          tone_sequence: ["gentle", "firm"],
        },
        send_via: "mailgun",
        status: "draft",
        created_at: "2025-03-30T10:00:00.000Z",
        payment_method: {
          kind: "stripe_link",
          url: "https://pay.due.so/northwind",
          label: "Stripe hosted invoice",
          instructions: "Link stays active for 7 days after each reminder.",
        },
      },
    ],
  },
  arborlane: {
    client: {
      id: "arborlane",
    name: "Arbor Lane",
    email: "accounts@arborlane.com",
    company_name: "Arbor Lane Studio",
    phone: "+1 (646) 555-1020",
    notes: "Send PDF invoice each time. Copy finance lead.",
    created_at: "2024-11-14T16:12:00.000Z",
    updated_at: "2025-03-05T09:25:00.000Z",
    client_type: "business",
  },
    reminders: [
      {
        id: "arborlane-r1",
        amount: 2200,
        currency: "USD",
        description: "Retainer instalment",
        due_date: "2025-04-10T00:00:00.000Z",
        reminder_schedule: {
          mode: "cadence",
          cadence: {
            frequency_days: 5,
            start_date: "2025-04-05",
            start_time: "09:30:00",
            max_reminders: 5,
          },
          tone_sequence: ["gentle", "firm"],
        },
        send_via: "gmail",
        status: "queued",
        created_at: "2025-04-01T08:00:00.000Z",
        payment_method: {
          kind: "ach",
          ach_bank_name: "Citi Business",
          ach_account_number: "****5421",
          ach_routing_number: "321081669",
          ach_account_type: "Checking",
          instructions: "Reference invoice AL-RET-04 on the transfer memo.",
        },
      },
    ],
  },
  sableworks: {
    client: {
      id: "sableworks",
    name: "Sable Works",
    email: "hello@sableworks.io",
    company_name: "Sable Works",
    phone: "+1 (323) 555-6711",
    notes: "Paid via Stripe invoices. Low follow-up needed.",
    created_at: "2024-09-02T15:00:00.000Z",
    updated_at: "2025-03-18T11:40:00.000Z",
    client_type: "business",
  },
    reminders: [
      {
        id: "sable-r1",
        amount: 1450,
        currency: "USD",
        description: "March maintenance block",
        due_date: "2025-03-20T00:00:00.000Z",
        reminder_schedule: {
          mode: "manual",
          manual_dates: [
            "2025-03-18T10:00:00.000Z",
            "2025-03-19T10:00:00.000Z",
            "2025-03-20T10:00:00.000Z",
          ],
          tone_sequence: ["gentle", "firm", "firm"],
        },
        send_via: "mailgun",
        status: "paid",
        created_at: "2025-03-17T08:30:00.000Z",
        payment_method: {
          kind: "cashapp_handle",
          handle: "@sableworks",
          label: "Cash App",
          instructions: "Send as goods & services to auto-close the reminder.",
        },
      },
    ],
  },
  brightlabs: {
    client: {
      id: "brightlabs",
      name: "Bright Labs",
      email: "ops@brightlabs.ai",
      company_name: "Bright Labs",
      phone: "+1 (917) 555-4432",
      notes: "Send payment links + bank transfer details.",
      created_at: "2024-12-11T12:00:00.000Z",
      updated_at: "2025-03-22T10:15:00.000Z",
      client_type: "business",
    },
    reminders: [
      {
        id: "brightlabs-r1",
        amount: 2980,
        currency: "USD",
        description: "Invoice #1042 — model audit",
        due_date: "2025-04-08T00:00:00.000Z",
        reminder_schedule: {
          mode: "cadence",
          cadence: {
            frequency_days: 4,
            start_time: "09:00:00",
            max_reminders: 4,
          },
          tone_sequence: ["gentle", "firm"],
        },
        send_via: "mailgun",
        status: "paid",
        created_at: "2025-03-28T07:45:00.000Z",
        payment_method: {
          kind: "wise_account",
          iban: "GB21WISE12345678901234",
          bic: "WISEGB2L",
          label: "Wise multi-currency",
          instructions: "Mark the transfer as \"Invoice 1042\" for quick matching.",
        },
      },
    ],
  },
  edenmiller: {
    client: {
      id: "edenmiller",
      name: "Eden Miller",
      email: "eden.miller@email.com",
      company_name: "Freelance producer",
      phone: "+1 (510) 555-4822",
      notes: "Prefers SMS before each reminder. Pays via Venmo handle.",
      created_at: "2024-10-01T09:12:00.000Z",
      updated_at: "2025-03-12T08:00:00.000Z",
      client_type: "individual",
    },
    reminders: [
      {
        id: "eden-r1",
        amount: 1250,
        currency: "USD",
        description: "Video edits — March round",
        due_date: "2025-04-05T00:00:00.000Z",
        reminder_schedule: {
          mode: "weekly",
          weekly_pattern: {
            weekdays: [2],
            time_of_day: "10:30:00",
            max_reminders: 3,
          },
          tone_sequence: ["gentle"],
        },
        send_via: "mailgun",
        status: "queued",
        created_at: "2025-03-25T09:15:00.000Z",
        payment_method: {
          kind: "venmo_handle",
          handle: "@payeden",
          instructions: "Send as personal payment and add project name in the memo.",
        },
      },
    ],
  },
  atlas: {
    client: {
      id: "atlas",
    name: "Atlas Group",
    email: "finance@atlasgroup.io",
    company_name: "Atlas Group",
    phone: "+1 (408) 555-9002",
    notes: "Prefers concise subject lines. Paid last Friday.",
    created_at: "2024-07-05T18:00:00.000Z",
    updated_at: "2025-03-28T18:00:00.000Z",
    client_type: "business",
    },
    reminders: [],
  },
  fjord: {
    client: {
      id: "fjord",
    name: "Fjord Consulting",
    email: "accounts@fjord.co",
    company_name: "Fjord Consulting",
    phone: "+1 (312) 555-2211",
    notes: "Project closed out. Keep reminders muted.",
    created_at: "2024-08-19T10:00:00.000Z",
    updated_at: "2025-03-15T15:20:00.000Z",
    client_type: "business",
    },
    reminders: [],
  },
};
