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

export function useWebSocket(roomId: string | null): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shouldReconnectRef = useRef(false);

  const connect = useCallback(() => {
    if (!roomId || !shouldReconnectRef.current) return;

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
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const msg: ServerMessage = JSON.parse(event.data);
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
      setConnected(false);
      if (!shouldReconnectRef.current) {
        return;
      }
      reconnectTimer.current = setTimeout(() => {
        if (shouldReconnectRef.current) {
          connect();
        }
      }, 2000);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      ws.close();
    };
  }, [roomId]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimer.current);
      const currentWebSocket = wsRef.current;
      wsRef.current = null;
      currentWebSocket?.close();
    };
  }, [connect]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { room, connected, myId, send };
}
