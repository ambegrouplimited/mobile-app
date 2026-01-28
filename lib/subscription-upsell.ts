import type { SubscriptionPlanSummary } from "@/services/subscription-settings";

type Listener = (state: UpsellState) => void;

type UpsellState = {
  open: boolean;
  message?: string;
  headline?: string;
};

const listeners = new Set<Listener>();
const planListeners = new Set<(summary: SubscriptionPlanSummary) => void>();
let currentState: UpsellState = { open: false };
let planSummary: SubscriptionPlanSummary | null = null;

function emit() {
  listeners.forEach((listener) => listener(currentState));
}

export function openSubscriptionUpsell(
  message?: string,
  options?: { headline?: string }
) {
  currentState = { open: true, message, headline: options?.headline };
  emit();
}

export function closeSubscriptionUpsell() {
  if (!currentState.open) {
    return;
  }
  currentState = { open: false, message: undefined };
  emit();
}

export function subscribeToSubscriptionUpsell(listener: Listener) {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getSubscriptionUpsellState(): UpsellState {
  return currentState;
}

export function getCachedPlanSummary(): SubscriptionPlanSummary | null {
  return planSummary;
}

export function setCachedPlanSummary(summary: SubscriptionPlanSummary) {
  planSummary = summary;
  planListeners.forEach((listener) => listener(summary));
}

export function subscribeToPlanSummaryUpdates(
  listener: (summary: SubscriptionPlanSummary) => void
) {
  planListeners.add(listener);
  if (planSummary) {
    listener(planSummary);
  }
  return () => {
    planListeners.delete(listener);
  };
}
