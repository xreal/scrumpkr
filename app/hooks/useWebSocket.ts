import { useRef, useState, useCallback, useEffect } from "react";
import type { ClientMessage, Room, ServerMessage } from "~/lib/types";
import {
  REMOVED_FROM_ROOM_MESSAGE,
  ROOM_FULL_MESSAGE,
  ROOM_LOOKUP_ERROR_MESSAGE,
  TOO_MANY_CONNECTIONS_MESSAGE,
} from "~/lib/room-join";
import {
  getParticipantId,
  setParticipantId,
  getParticipantToken,
  setParticipantToken,
  setLastRoom,
} from "~/lib/storage";

interface UseWebSocketReturn {
  room: Room | null;
  connected: boolean;
  myId: string | null;
  send: (msg: ClientMessage) => void;
  actionError: string | null;
  connectionError: string | null;
  isReconnecting: boolean;
  retryConnection: () => void;
}

interface ConnectionCheckResponse {
  ok?: boolean;
  code?: string;
  error?: string;
}

function isPokeMessage(msg: ServerMessage): msg is Extract<ServerMessage, { type: "poke" }> {
  return msg.type === "poke";
}

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

function isSocketOpenOrConnecting(socket: WebSocket | null): boolean {
  if (!socket) {
    return false;
  }

  return (
    socket.readyState === WebSocket.OPEN ||
    socket.readyState === WebSocket.CONNECTING
  );
}

function getReconnectDelay(attempt: number): number {
  return Math.min(
    INITIAL_RECONNECT_DELAY_MS * 2 ** attempt,
    MAX_RECONNECT_DELAY_MS
  );
}

function buildWebSocketUrl(roomId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const participantId = getParticipantId(roomId);
  const participantToken = getParticipantToken(roomId);
  const params = new URLSearchParams();

  if (participantId) {
    params.set("participantId", participantId);
  }

  if (participantToken) {
    params.set("token", participantToken);
  }

  const query = params.toString();
  return `${protocol}//${window.location.host}/ws/${roomId}${query ? `?${query}` : ""}`;
}

function parseServerMessage(payload: unknown): ServerMessage | null {
  if (typeof payload !== "string") {
    return null;
  }

  try {
    return JSON.parse(payload) as ServerMessage;
  } catch {
    return null;
  }
}

function mapSocketActionError(error: string): string | null {
  switch (error) {
    case "Round already revealed":
      return "This round is already revealed. Reset the round to vote again.";
    case "Invalid vote value":
      return "That vote could not be saved. Please try again.";
    default:
      return null;
  }
}

function mapConnectionCheckError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "room_not_found":
      return "Room not found.";
    case "too_many_connections":
      return TOO_MANY_CONNECTIONS_MESSAGE;
    case "room_full":
      return ROOM_FULL_MESSAGE;
    default:
      return fallback || ROOM_LOOKUP_ERROR_MESSAGE;
  }
}

function mapSocketCloseReason(reason: string): string | null {
  if (reason === "Removed from room") {
    return REMOVED_FROM_ROOM_MESSAGE;
  }

  return null;
}

async function checkConnection(roomId: string): Promise<string | null> {
  const participantId = getParticipantId(roomId);
  const participantToken = getParticipantToken(roomId);
  const params = new URLSearchParams({ roomId });

  if (participantId) {
    params.set("participantId", participantId);
  }

  if (participantToken) {
    params.set("token", participantToken);
  }

  try {
    const response = await fetch(`/api/rooms/connect?${params.toString()}`);
    if (response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as ConnectionCheckResponse | null;
    return mapConnectionCheckError(payload?.code, payload?.error);
  } catch {
    return null;
  }
}

export function useWebSocket(
  roomId: string | null,
  onPoke?: (fromName: string) => void
): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current !== null) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const closeCurrentSocket = useCallback(() => {
    const currentSocket = wsRef.current;
    wsRef.current = null;
    currentSocket?.close();
  }, []);

  const connect = useCallback(async () => {
    if (!roomId || !shouldReconnectRef.current) {
      return;
    }

    if (isSocketOpenOrConnecting(wsRef.current)) {
      return;
    }

    const blockingError = await checkConnection(roomId);
    if (!shouldReconnectRef.current || isSocketOpenOrConnecting(wsRef.current)) {
      return;
    }

    if (blockingError) {
      setConnectionError(blockingError);
      setConnected(false);
      setIsReconnecting(false);
      return;
    }

    setConnectionError(null);

    const ws = new WebSocket(buildWebSocketUrl(roomId));
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      setConnected(true);
      setIsReconnecting(false);
      setConnectionError(null);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const msg = parseServerMessage(event.data);
      if (!msg) return;

      if (isPokeMessage(msg)) {
        onPoke?.(msg.fromName);
        return;
      }

      if (msg.type === "error") {
        const nextActionError = mapSocketActionError(msg.error);
        if (nextActionError) {
          setActionError(nextActionError);
        }
        return;
      }

      if (msg.type !== "room_state") {
        return;
      }

      setActionError(null);
      setRoom(msg.room);
      if (msg.yourId) {
        setMyId(msg.yourId);
        setParticipantId(roomId, msg.yourId);
      }
      if (msg.yourToken) {
        setParticipantToken(roomId, msg.yourToken);
      }
      setLastRoom(roomId);
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setConnected(false);

      const nextConnectionError = mapSocketCloseReason(event.reason);
      if (nextConnectionError) {
        shouldReconnectRef.current = false;
        clearReconnectTimer();
        setRoom(null);
        setConnectionError(nextConnectionError);
        setIsReconnecting(false);
        return;
      }

      if (!shouldReconnectRef.current) {
        return;
      }

      const reconnectDelay = getReconnectDelay(reconnectAttemptsRef.current);

      reconnectAttemptsRef.current += 1;
      setIsReconnecting(true);
      reconnectTimer.current = setTimeout(() => {
        if (shouldReconnectRef.current) {
          void connect();
        }
      }, reconnectDelay);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, clearReconnectTimer, onPoke]);

  useEffect(() => {
    setRoom(null);
    setMyId(null);
    setConnected(false);
    setActionError(null);
    setConnectionError(null);
    setIsReconnecting(false);

    if (!roomId) {
      shouldReconnectRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      closeCurrentSocket();
      return;
    }

    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    void connect();

    return () => {
      shouldReconnectRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      closeCurrentSocket();
    };
  }, [roomId, connect, clearReconnectTimer, closeCurrentSocket]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setActionError(null);
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const retryConnection = useCallback(() => {
    if (!roomId) {
      return;
    }

    setActionError(null);
    setConnectionError(null);
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
    shouldReconnectRef.current = true;
    clearReconnectTimer();
    closeCurrentSocket();
    void connect();
  }, [roomId, clearReconnectTimer, closeCurrentSocket, connect]);

  return {
    room,
    connected,
    myId,
    send,
    actionError,
    connectionError,
    isReconnecting,
    retryConnection,
  };
}
