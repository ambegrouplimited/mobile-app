import { apiFetch, toQueryString } from "@/lib/api-client";
import type { ClientMessage } from "@/types/messages";

export function fetchClientMessages(
  clientId: string,
  token: string,
  params?: { limit?: number }
) {
  const query = toQueryString({
    limit: params?.limit ? String(params.limit) : undefined,
  });
  return apiFetch<ClientMessage[]>(
    `/api/messages/clients/${clientId}${query}`,
    { token }
  );
}
