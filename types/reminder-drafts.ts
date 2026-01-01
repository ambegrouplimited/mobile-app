export type ReminderDraftMetadata = {
  client_name?: string | null;
  amount_display?: string | null;
  status?: string | null;
  next_action?: string | null;
  subtitle?: string | null;
};

export type ReminderDraft = {
  id: string;
  user_id: string;
  params: Record<string, string>;
  last_step?: string | null;
  last_path?: string | null;
  metadata: ReminderDraftMetadata;
  created_at: string;
  updated_at: string;
};

export type ReminderDraftCreatePayload = {
  params?: Record<string, string>;
  last_step?: string | null;
  last_path?: string | null;
  metadata?: ReminderDraftMetadata | null;
};

export type ReminderDraftUpdatePayload = ReminderDraftCreatePayload;
