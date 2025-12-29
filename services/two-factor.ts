import { apiFetch } from "@/lib/api-client";

export type TwoFactorStatus = {
  enabled: boolean;
  pending_setup: boolean;
};

export type TwoFactorSetupResponse = {
  secret: string;
  otpauth_url: string;
};

export function fetchTwoFactorStatus(token: string) {
  return apiFetch<TwoFactorStatus>("/api/security/2fa/status", {
    method: "GET",
    token,
  });
}

export function requestTwoFactorEmailOtp(token: string) {
  return apiFetch<void>("/api/security/2fa/email-otp", {
    method: "POST",
    token,
  });
}

export function beginTwoFactorSetup(payload: { emailOtp: string }, token: string) {
  return apiFetch<TwoFactorSetupResponse>("/api/security/2fa/setup", {
    method: "POST",
    token,
    body: { email_otp: payload.emailOtp },
  });
}

export function confirmTwoFactor(payload: { code: string }, token: string) {
  return apiFetch<TwoFactorStatus>("/api/security/2fa/confirm", {
    method: "POST",
    token,
    body: { code: payload.code },
  });
}

export function disableTwoFactor(payload: { code: string }, token: string) {
  return apiFetch<TwoFactorStatus>("/api/security/2fa/disable", {
    method: "POST",
    token,
    body: { code: payload.code },
  });
}
