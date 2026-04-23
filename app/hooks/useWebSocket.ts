import { useRef, useState, useCallback, useEffect } from "react";
import type { ClientMessage, Room, ServerMessage } from "~/lib/types";
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

export function useWebSocket(
  roomId: string | null,
  onPoke?: (fromName: string) => void
): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
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

  const connect = useCallback(() => {
    if (!roomId || !shouldReconnectRef.current) {
      return;
    }

    if (isSocketOpenOrConnecting(wsRef.current)) {
      return;
    }

    const ws = new WebSocket(buildWebSocketUrl(roomId));
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const msg = parseServerMessage(event.data);
      if (!msg) return;

      if (isPokeMessage(msg)) {
        onPoke?.(msg.fromName);
        return;
      }

      if (msg.type !== "room_state") {
        return;
      }

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

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setConnected(false);
      if (!shouldReconnectRef.current) {
        return;
      }

      const reconnectDelay = getReconnectDelay(reconnectAttemptsRef.current);

      reconnectAttemptsRef.current += 1;
      reconnectTimer.current = setTimeout(() => {
        if (shouldReconnectRef.current) {
          connect();
        }
      }, reconnectDelay);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, clearReconnectTimer]);

  useEffect(() => {
    setRoom(null);
    setMyId(null);
    setConnected(false);

    if (!roomId) {
      shouldReconnectRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      closeCurrentSocket();
      return;
    }

    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      closeCurrentSocket();
    };
  }, [roomId, connect, clearReconnectTimer, closeCurrentSocket]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { room, connected, myId, send };
}
