import { useCallback } from "react";
import type { ParticipantMode } from "~/hooks/useRoomIdentity";
import type { CardValue } from "~/lib/deck";
import type { ClientMessage } from "~/lib/types";

interface UseRoomActionsParams {
  myId: string | null;
  myVote: string | null;
  isRoundRevealed: boolean;
  send: (msg: ClientMessage) => void;
  setMyVote: (vote: string | null) => void;
  updateName: (newName: string) => string | null;
  updateMode: (newMode: ParticipantMode) => void;
  navigate: (to: string) => void;
}

interface UseRoomActionsResult {
  handleVote: (value: CardValue) => void;
  handleReveal: () => void;
  handleReset: () => void;
  handleClearHistory: () => void;
  handleSetName: (newName: string) => void;
  handleSetMode: (newMode: ParticipantMode) => void;
  handleSetTitle: (title: string) => void;
  handleRemoveParticipant: (removeId: string) => void;
  handleSendPoke: (targetId: string) => void;
  handleLeave: () => void;
}

export function useRoomActions({
  myId,
  myVote,
  isRoundRevealed,
  send,
  setMyVote,
  updateName,
  updateMode,
  navigate,
}: UseRoomActionsParams): UseRoomActionsResult {
  const handleVote = useCallback(
    (value: CardValue) => {
      if (!myId || isRoundRevealed) {
        return;
      }

      const newVote = myVote === value ? null : value;
      setMyVote(newVote);
      send({ action: "vote", participantId: myId, vote: newVote });
    },
    [myId, isRoundRevealed, myVote, setMyVote, send]
  );

  const handleReveal = useCallback(() => {
    if (!myId) {
      return;
    }

    send({ action: "reveal", participantId: myId });
  }, [myId, send]);

  const handleReset = useCallback(() => {
    if (!myId) {
      return;
    }

    setMyVote(null);
    send({ action: "reset_round", participantId: myId });
  }, [myId, setMyVote, send]);

  const handleClearHistory = useCallback(() => {
    if (!myId) {
      return;
    }

    send({ action: "clear_history", participantId: myId });
  }, [myId, send]);

  const handleSetName = useCallback(
    (newName: string) => {
      if (!myId) {
        return;
      }

      const trimmedName = updateName(newName);
      if (!trimmedName) {
        return;
      }

      send({ action: "set_name", participantId: myId, name: trimmedName });
    },
    [myId, updateName, send]
  );

  const handleSetMode = useCallback(
    (newMode: ParticipantMode) => {
      if (!myId) {
        return;
      }

      updateMode(newMode);
      send({ action: "set_mode", participantId: myId, mode: newMode });
    },
    [myId, updateMode, send]
  );

  const handleSetTitle = useCallback(
    (title: string) => {
      if (!myId) {
        return;
      }

      send({ action: "set_title", participantId: myId, title });
    },
    [myId, send]
  );

  const handleRemoveParticipant = useCallback(
    (removeId: string) => {
      if (!myId) {
        return;
      }

      send({ action: "remove_participant", participantId: myId, removeId });
    },
    [myId, send]
  );

  const handleSendPoke = useCallback(
    (targetId: string) => {
      if (!myId) {
        return;
      }
      send({ action: "poke", participantId: myId, targetId });
    },
    [myId, send]
  );

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return {
    handleVote,
    handleReveal,
    handleReset,
    handleClearHistory,
    handleSetName,
    handleSetMode,
    handleSetTitle,
    handleRemoveParticipant,
    handleSendPoke,
    handleLeave,
  };
}
