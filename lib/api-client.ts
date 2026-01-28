import { Platform } from "react-native";

import { openSubscriptionUpsell } from "./subscription-upsell";

const LOCAL_DEV_BASE_URL = Platform.select({
  android: "http://10.0.2.2:8000",
  default: "http://localhost:8000",
});

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? LOCAL_DEV_BASE_URL!;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  token?: string;
};

export function toQueryString(
  params: Record<string, string | null | undefined>
) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const hasBody = response.status !== 204 && response.status !== 205;
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");

  if (!response.ok) {
    const detail =
      hasBody && isJson
        ? await response.json().catch(() => undefined)
        : await response.text();
    const errorMessage =
      typeof detail === "string"
        ? detail
        : detail?.detail?.[0]?.msg ??
          detail?.message ??
          "Request failed. Please try again.";
    if (response.status === 402) {
      openSubscriptionUpsell();
    }
    const error = new Error(errorMessage) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (!hasBody) {
    return undefined as T;
  }

  if (!isJson) {
    return null as T;
  }

  return (await response.json()) as T;
}
