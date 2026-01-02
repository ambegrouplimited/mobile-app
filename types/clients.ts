export type ContactMethodType =
  | "email"
  | "email_gmail"
  | "email_outlook"
  | "slack"
  | "whatsapp"
  | "telegram";

export type ContactMethod = {
  id: string;
  type: ContactMethodType;
  label: string;
  email: string | null;
  phone: string | null;
  slack_team_id: string | null;
  slack_user_id: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ContactMethodPayload = {
  id?: string;
  type: ContactMethodType;
  label: string;
  email?: string | null;
  phone?: string | null;
  slack_team_id?: string | null;
  slack_user_id?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
};

export type ClientType = "business" | "individual";

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name?: string | null;
  notes?: string | null;
  client_type: ClientType;
  timezone?: string | null;
  contact_methods: ContactMethod[];
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ClientCreatePayload = {
  name: string;
  company_name?: string | null;
  notes?: string | null;
  client_type: ClientType;
  timezone?: string | null;
  contact_methods: ContactMethodPayload[];
};

export type ClientUpdatePayload = Partial<ClientCreatePayload>;
