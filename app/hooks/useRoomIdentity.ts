import { useEffect, useState, useCallback } from "react";
import {
  getDisplayName,
  getPreferredMode,
  setDisplayName,
  setPreferredMode,
} from "~/lib/storage";

type ParticipantMode = "voter" | "spectator";

interface UseRoomIdentityResult {
  name: string;
  nameInput: string;
  mode: ParticipantMode;
  identityLoaded: boolean;
  nameConfirmed: boolean;
  setNameInput: (value: string) => void;
  confirmName: () => boolean;
  updateName: (newName: string) => string | null;
  updateMode: (newMode: ParticipantMode) => void;
  syncFromParticipantName: (participantName?: string) => void;
}

function normalizeName(rawName: string): string {
  return rawName.trim();
}

export function useRoomIdentity(roomId?: string): UseRoomIdentityResult {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [mode, setMode] = useState<ParticipantMode>("voter");
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [nameConfirmed, setNameConfirmed] = useState(false);

  useEffect(() => {
    setIdentityLoaded(false);
    setName("");
    setNameInput("");
    setNameConfirmed(false);
    setMode("voter");

    const storedName = getDisplayName(roomId || null);
    if (storedName) {
      setName(storedName);
      setNameInput(storedName);
      setNameConfirmed(true);
    }

    const storedMode = getPreferredMode(roomId || null);
    if (storedMode) {
      setMode(storedMode);
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

  const updateMode = useCallback(
    (newMode: ParticipantMode) => {
      setMode(newMode);
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
    mode,
    identityLoaded,
    nameConfirmed,
    setNameInput,
    confirmName,
    updateName,
    updateMode,
    syncFromParticipantName,
  };
}

export type { ParticipantMode };
