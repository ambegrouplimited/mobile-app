import { apiFetch } from "@/lib/api-client";
import type { SubscriptionInfo } from "@/services/auth";

export function fetchSubscriptionSummary(token: string) {
  return apiFetch<SubscriptionInfo>("/api/subscriptions/me", {
    method: "GET",
    token,
  });
}
