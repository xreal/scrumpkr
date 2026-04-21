import { useRef, useState, useCallback, useEffect } from "react";
import type { Room, ServerMessage } from "~/lib/types";
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
  send: (msg: object) => void;
}

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

export function useWebSocket(roomId: string | null): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    reconnectTimer.current = undefined;
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

    const currentSocket = wsRef.current;
    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.OPEN ||
        currentSocket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const storedId = getParticipantId(roomId);
    const storedToken = getParticipantToken(roomId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams();
    if (storedId) {
      params.set("participantId", storedId);
    }
    if (storedToken) {
      params.set("token", storedToken);
    }
    const query = params.toString();
    const url = `${protocol}//${window.location.host}/ws/${roomId}${query ? `?${query}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === "room_state") {
        setRoom(msg.room);
        if (msg.yourId) {
          setMyId(msg.yourId);
          setParticipantId(roomId, msg.yourId);
        }
        if (msg.yourToken) {
          setParticipantToken(roomId, msg.yourToken);
        }
        setLastRoom(roomId);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setConnected(false);
      if (!shouldReconnectRef.current) {
        return;
      }

      const reconnectDelay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current,
        MAX_RECONNECT_DELAY_MS
      );

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
