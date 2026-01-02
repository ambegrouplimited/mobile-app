import { apiFetch, toQueryString } from "@/lib/api-client";
import type {
  ClientMessage,
  ConversationSummary,
  MessageSendPayload,
  MessageSendResponse,
} from "@/types/messages";

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

export function fetchConversationSummaries(
  token: string,
  params?: { limit?: number }
) {
  const query = params?.limit
    ? toQueryString({ limit: String(params.limit) })
    : "";
  return apiFetch<ConversationSummary[]>(
    `/api/messages/conversations${query}`,
    { token }
  );
}

export function sendClientMessage(
  payload: MessageSendPayload,
  token: string
) {
  return apiFetch<MessageSendResponse>("/api/messages/send", {
    method: "POST",
    body: payload,
    token,
  });
}
