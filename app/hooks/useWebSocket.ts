import { useRef, useState, useCallback, useEffect } from "react";
import type { Room, ServerMessage } from "~/lib/types";
import {
  getParticipantId,
  setParticipantId,
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

  const connect = useCallback(() => {
    if (!roomId) return;

    const storedId = getParticipantId(roomId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/${roomId}${storedId ? `?participantId=${storedId}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "room_state") {
        setRoom(msg.room);
        if (msg.yourId) {
          setMyId(msg.yourId);
          setParticipantId(roomId, msg.yourId);
        }
        setLastRoom(roomId);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(() => connect(), 2000);
    };

    ws.onerror = () => ws.close();
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { room, connected, myId, send };
}
