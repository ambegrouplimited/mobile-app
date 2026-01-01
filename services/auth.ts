import { apiFetch, toQueryString } from "@/lib/api-client";
import { buildSessionClientMetadata } from "@/lib/session-metadata";

export type NotificationSettings = {
  push_notifications: boolean;
  messages: boolean;
  reminder_pre_notifications?: {
    enabled: boolean;
    count: number;
    lead_minutes: number;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  type: "freelancer" | "business" | "small_business" | string;
  created_at: string;
  notification_settings?: NotificationSettings;
  channels?: Record<string, boolean>;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  user: AuthUser;
};

export type OAuthProvider = "google" | "apple";

export type TwoFactorChallengeResponse = {
  two_factor_required: true;
  two_factor_token: string;
  user: AuthUser;
};

export type AuthExchangeResponse = TokenResponse | TwoFactorChallengeResponse;

function getProviderPath(provider: OAuthProvider, action: "url" | "exchange") {
  return `/api/auth/${provider}/${action === "url" ? "url" : "exchange"}`;
}

export async function getAuthorizationUrl(
  provider: OAuthProvider,
  params: { redirectUri: string; state?: string; codeChallenge?: string; codeChallengeMethod?: string }
) {
  const query = toQueryString({
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
  });

  const response = await apiFetch<{ authorization_url: string }>(`${getProviderPath(provider, "url")}${query}`);
  return response.authorization_url;
}

export function exchangeGoogleCode(payload: { code: string; redirectUri: string; codeVerifier?: string; userType?: string }) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<AuthExchangeResponse>(getProviderPath("google", "exchange"), {
    method: "POST",
    body: {
      code: payload.code,
      redirect_uri: payload.redirectUri,
      code_verifier: payload.codeVerifier,
      user_type: payload.userType ?? "freelancer",
      client: clientMeta,
    },
  });
}

export function exchangeGoogleIdToken(payload: { idToken: string; userType?: string }) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<AuthExchangeResponse>(getProviderPath("google", "exchange"), {
    method: "POST",
    body: {
      id_token: payload.idToken,
      user_type: payload.userType ?? "freelancer",
      client: clientMeta,
    },
  });
}

export function exchangeAppleCode(payload: { code: string; redirectUri: string; fullName?: string; userType?: string }) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<AuthExchangeResponse>(getProviderPath("apple", "exchange"), {
    method: "POST",
    body: {
      code: payload.code,
      redirect_uri: payload.redirectUri,
      user_type: payload.userType ?? "freelancer",
      full_name: payload.fullName,
      client: clientMeta,
    },
  });
}

export function verifyTwoFactorCode(payload: { twoFactorToken: string; code: string }) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<TokenResponse>("/api/auth/verify-2fa", {
    method: "POST",
    body: {
      two_factor_token: payload.twoFactorToken,
      code: payload.code,
      client: clientMeta,
    },
  });
}

export function refreshAuthTokens(refreshToken: string) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<TokenResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken, client: clientMeta },
  });
}

export function requestTwoFactorRecovery(twoFactorToken: string) {
  return apiFetch<void>("/api/auth/recover-2fa/email-otp", {
    method: "POST",
    body: {
      two_factor_token: twoFactorToken,
    },
  });
}

export function confirmTwoFactorRecovery(payload: { twoFactorToken: string; emailCode: string }) {
  const clientMeta = buildSessionClientMetadata();
  return apiFetch<TokenResponse>("/api/auth/recover-2fa/confirm", {
    method: "POST",
    body: {
      two_factor_token: payload.twoFactorToken,
      email_code: payload.emailCode,
      client: clientMeta,
    },
  });
}

export type UpdateUserPayload = {
  name?: string;
  type?: string;
  notification_settings?: Partial<NotificationSettings>;
};

export function updateCurrentUser(payload: UpdateUserPayload, token: string) {
  return apiFetch<AuthUser>("/api/users/me", {
    method: "PATCH",
    body: payload,
    token,
  });
}
