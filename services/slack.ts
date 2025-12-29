import { apiFetch, toQueryString } from "@/lib/api-client";

export type SlackWorkspace = {
  team_id: string;
  team_name?: string;
  authed_user_id?: string;
  expires_at?: string;
};

export type SlackStatus = {
  onboarding_url?: string;
  workspaces: SlackWorkspace[];
};

export type SlackConversation = {
  id: string;
  name: string;
  type: string;
  is_private: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_archived: boolean;
};

export type SlackUser = {
  id: string;
  name: string;
  real_name: string;
  display_name?: string;
  is_bot: boolean;
  is_app_user: boolean;
};

export function fetchSlackStatus(token: string, options?: { redirectUri?: string }) {
  const query = toQueryString({
    redirect_uri: options?.redirectUri,
  });
  return apiFetch<SlackStatus>(`/api/messaging/slack${query}`, {
    method: "GET",
    token,
  });
}

export function connectSlackAccount(payload: { code: string; state: string; redirectUri?: string }, token: string) {
  const query = toQueryString({
    code: payload.code,
    state: payload.state,
    redirect_uri: payload.redirectUri,
  });
  return apiFetch<SlackWorkspace>(`/api/messaging/slack/connect${query}`, {
    method: "POST",
    token,
  });
}

export function disconnectSlackAccount(teamId: string, token: string) {
  const query = toQueryString({ team_id: teamId });
  return apiFetch<void>(`/api/messaging/slack${query}`, {
    method: "DELETE",
    token,
  });
}

export function fetchSlackConversations(teamId: string, token: string) {
  const query = toQueryString({ team_id: teamId });
  return apiFetch<SlackConversation[]>(`/api/messaging/slack/conversations${query}`, {
    method: "GET",
    token,
  });
}

export function fetchSlackUsers(teamId: string, token: string) {
  const query = toQueryString({ team_id: teamId });
  return apiFetch<SlackUser[]>(`/api/messaging/slack/users${query}`, {
    method: "GET",
    token,
  });
}
