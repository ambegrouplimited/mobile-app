import { API_BASE_URL } from "@/lib/api-client";
import type { MessageStreamEvent } from "@/types/messages";

type Listener = (event: MessageStreamEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let currentToken: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function buildWebSocketUrl(token: string) {
  const base = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const scheme = base.startsWith("https") ? "wss" : "ws";
  const url = base.replace(/^https?/, scheme);
  return `${url}/api/messages/stream?token=${encodeURIComponent(token)}`;
}

function broadcast(event: MessageStreamEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.warn("Message stream listener failed", err);
    }
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function teardownSocket() {
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
    socket = null;
  }
  clearReconnectTimer();
}

function connect(token: string) {
  teardownSocket();
  currentToken = token;
  const wsUrl = buildWebSocketUrl(token);
  socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      const data: MessageStreamEvent = JSON.parse(event.data);
      broadcast(data);
    } catch (err) {
      console.warn("Failed to parse message stream payload", err);
    }
  };

  socket.onerror = () => {
    // Trigger close -> reconnect
    socket?.close();
  };

  socket.onclose = () => {
    socket = null;
    if (listeners.size > 0) {
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        if (currentToken) {
          connect(currentToken);
        }
      }, 2000);
    }
  };
}

export function subscribeToMessageEvents(
  token: string,
  listener: Listener
): () => void {
  listeners.add(listener);
  if (!socket || currentToken !== token) {
    connect(token);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      currentToken = null;
      teardownSocket();
    }
  };
}
