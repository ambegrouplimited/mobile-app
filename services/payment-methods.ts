import { apiFetch } from "@/lib/api-client";
import type {
  PaymentMethod,
  PaymentMethodCreatePayload,
  PaymentMethodUpdatePayload,
} from "@/types/payment-methods";

export function fetchPaymentMethods(token: string) {
  return apiFetch<PaymentMethod[]>("/api/payment-methods", {
    token,
  });
}

export function fetchPaymentMethodDetails(id: string, token: string) {
  return apiFetch<PaymentMethod>(`/api/payment-methods/${id}/raw`, {
    token,
  });
}

export function createPaymentMethod(payload: PaymentMethodCreatePayload, token: string) {
  return apiFetch<PaymentMethod>("/api/payment-methods", {
    method: "POST",
    body: payload,
    token,
  });
}

export function updatePaymentMethod(id: string, payload: PaymentMethodUpdatePayload, token: string) {
  return apiFetch<PaymentMethod>(`/api/payment-methods/${id}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deletePaymentMethod(id: string, token: string) {
  return apiFetch<void>(`/api/payment-methods/${id}`, {
    method: "DELETE",
    token,
  });
}
