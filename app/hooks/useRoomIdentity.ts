import { useEffect, useState, useCallback } from "react";
import type { ParticipantViewMode } from "~/lib/participant-view-mode";
import { toServerMode } from "~/lib/participant-view-mode";
import {
  getDisplayName,
  getPreferredMode,
  setDisplayName,
  setPreferredMode,
} from "~/lib/storage";

type ServerParticipantMode = ReturnType<typeof toServerMode>;

interface UseRoomIdentityResult {
  name: string;
  nameInput: string;
  viewMode: ParticipantViewMode;
  serverMode: ServerParticipantMode;
  identityLoaded: boolean;
  nameConfirmed: boolean;
  setNameInput: (value: string) => void;
  confirmName: () => boolean;
  updateName: (newName: string) => string | null;
  updateViewMode: (newMode: ParticipantViewMode) => void;
  syncFromParticipantName: (participantName?: string) => void;
}

function normalizeName(rawName: string): string {
  return rawName.trim();
}

export function useRoomIdentity(roomId?: string): UseRoomIdentityResult {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [viewMode, setViewMode] = useState<ParticipantViewMode>("voter");
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [nameConfirmed, setNameConfirmed] = useState(false);

  useEffect(() => {
    setIdentityLoaded(false);
    setName("");
    setNameInput("");
    setNameConfirmed(false);
    setViewMode("voter");

    const storedName = getDisplayName(roomId || null);
    if (storedName) {
      setName(storedName);
      setNameInput(storedName);
      setNameConfirmed(true);
    }

    const storedMode = getPreferredMode(roomId || null);
    if (storedMode) {
      setViewMode(storedMode);
    }

    setIdentityLoaded(true);
  }, [roomId]);

  const confirmName = useCallback((): boolean => {
    const trimmedName = normalizeName(nameInput);
    if (!trimmedName) {
      return false;
    }

    setDisplayName(trimmedName, roomId || null);
    setName(trimmedName);
    setNameConfirmed(true);
    return true;
  }, [nameInput, roomId]);

  const updateName = useCallback(
    (newName: string): string | null => {
      const trimmedName = normalizeName(newName);
      if (!trimmedName) {
        return null;
      }

      setName(trimmedName);
      setNameInput(trimmedName);
      setDisplayName(trimmedName, roomId || null);
      return trimmedName;
    },
    [roomId]
  );

  const updateViewMode = useCallback(
    (newMode: ParticipantViewMode) => {
      setViewMode(newMode);
      setPreferredMode(newMode, roomId || null);
    },
    [roomId]
  );

  const syncFromParticipantName = useCallback((participantName?: string) => {
    if (!participantName) {
      return;
    }

    setName(participantName);
    setNameInput(participantName);
  }, []);

  return {
    name,
    nameInput,
    viewMode,
    serverMode: toServerMode(viewMode),
    identityLoaded,
    nameConfirmed,
    setNameInput,
    confirmName,
    updateName,
    updateViewMode,
    syncFromParticipantName,
  };
}

export type { ParticipantViewMode, ServerParticipantMode };
