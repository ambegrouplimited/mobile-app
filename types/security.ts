export type SessionInfo = {
  id: string;
  device_name?: string | null;
  platform?: string | null;
  app_version?: string | null;
  app_build?: string | null;
  location?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_active: string;
  current: boolean;
};
