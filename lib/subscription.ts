import type { SubscriptionInfo } from "@/services/auth";
import { openSubscriptionUpsell } from "./subscription-upsell";

const OUT_OF_REMINDERS_MESSAGE =
  "You don't have any free reminders left. Subscribe to keep sending follow-ups.";

function normalizeLimit(subscription?: SubscriptionInfo | null): number | null {
  if (!subscription) {
    return null;
  }
  if (subscription.is_active || subscription.is_trialing) {
    return null;
  }
  const limit =
    typeof subscription.reminder_limit === "number"
      ? subscription.reminder_limit
      : null;
  if (limit === null) {
    return null;
  }
  const used =
    typeof subscription.reminders_used_this_month === "number"
      ? subscription.reminders_used_this_month
      : 0;
  return Math.max(0, limit - used);
}

export function reminderQuotaRemaining(
  subscription?: SubscriptionInfo | null
): number | null {
  return normalizeLimit(subscription);
}

export function reminderQuotaAvailable(
  subscription?: SubscriptionInfo | null
): boolean {
  const remaining = reminderQuotaRemaining(subscription);
  return remaining === null || remaining > 0;
}

export function showReminderQuotaUpsell() {
  openSubscriptionUpsell(OUT_OF_REMINDERS_MESSAGE, {
    headline: "You're out of reminders",
  });
}
