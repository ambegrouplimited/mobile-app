import { apiFetch } from "@/lib/api-client";

export type SubscriptionPlanSummary = {
  plan_name: string;
  description?: string | null;
  rating: number;
  reviews_count: number;
  monthly_price: number;
  currency: string;
};

export function fetchSubscriptionPlanSummary() {
  return apiFetch<SubscriptionPlanSummary>("/api/web-app/summary");
}
