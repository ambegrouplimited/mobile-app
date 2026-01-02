export type MessageDirection = "incoming" | "outgoing";
export type MessageChannel =
  | "gmail"
  | "email"
  | "email_outlook"
  | "outlook"
  | "slack"
  | "whatsapp"
  | "telegram"
  | "mailgun"
  | "sms"
  | string;

export type ClientMessage = {
  channel: MessageChannel;
  direction: MessageDirection;
  sent_at: string;
  subject: string | null;
  preview: string | null;
  body?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConversationSummary = {
  client_id: string;
  client_name: string;
  contact_method_id: string;
  contact_label: string;
  channel: MessageChannel;
  last_message: ClientMessage;
  total_messages: number;
};

export type MessageSendPayload = {
  client_id: string;
  contact_method_id: string;
  subject?: string | null;
  body: string;
};

export type MessageSendResponse = {
  channel: MessageChannel;
  delivered: boolean;
  metadata?: Record<string, unknown>;
};
