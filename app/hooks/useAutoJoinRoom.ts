import { useEffect, useState } from "react";
import type { Room } from "~/lib/types";
import type { ParticipantMode } from "~/hooks/useRoomIdentity";

interface UseAutoJoinRoomParams {
  roomId?: string;
  room: Room | null;
  myId: string | null;
  connected: boolean;
  identityLoaded: boolean;
  nameConfirmed: boolean;
  name: string;
  mode: ParticipantMode;
  send: (msg: {
    action: "join";
    participantId: string;
    name: string;
    mode: ParticipantMode;
  }) => void;
}

export function useAutoJoinRoom({
  roomId,
  room,
  myId,
  connected,
  identityLoaded,
  nameConfirmed,
  name,
  mode,
  send,
}: UseAutoJoinRoomParams): void {
  const [joinRequested, setJoinRequested] = useState(false);

  useEffect(() => {
    setJoinRequested(false);
  }, [roomId]);

  useEffect(() => {
    if (!connected) {
      setJoinRequested(false);
    }
  }, [connected]);

  useEffect(() => {
    if (!room || !myId || !connected || !identityLoaded || !nameConfirmed) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || joinRequested) {
      return;
    }

    const isParticipantInRoom = room.participants.some(
      (participant) => participant.participantId === myId
    );
    if (isParticipantInRoom) {
      setJoinRequested(false);
      return;
    }

    send({ action: "join", participantId: myId, name: trimmedName, mode });
    setJoinRequested(true);
  }, [
    room,
    myId,
    connected,
    identityLoaded,
    nameConfirmed,
    name,
    mode,
    joinRequested,
    send,
  ]);
}
