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
