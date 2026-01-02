import { apiFetch, toQueryString } from "@/lib/api-client";
import type { Currency } from "@/types/currency";

type CurrencyQuery = {
  search?: string;
  limit?: number;
};

export function fetchCurrencies(params?: CurrencyQuery) {
  const query = toQueryString({
    search: params?.search?.trim() || undefined,
    limit: params?.limit ? String(Math.min(Math.max(params.limit, 1), 500)) : undefined,
  });
  return apiFetch<Currency[]>(`/api/currencies${query}`);
}
