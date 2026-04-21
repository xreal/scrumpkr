import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ActionControls } from "~/components/room/ActionControls";
import { ParticipantList } from "~/components/room/ParticipantList";
import { RemoveParticipantsModal } from "~/components/room/RemoveParticipantsModal";
import { RevealHistory } from "~/components/room/RevealHistory";
import { RoomHeader } from "~/components/room/RoomHeader";
import { SpectatorToggle } from "~/components/room/SpectatorToggle";
import { VoteResult } from "~/components/room/VoteResult";
import { VotingCard } from "~/components/room/VotingCard";
import { useRoomExistence } from "~/hooks/useRoomExistence";
import { useRoomIdentity, type ParticipantMode } from "~/hooks/useRoomIdentity";
import { useWebSocket } from "~/hooks/useWebSocket";
import { DECK, type CardValue } from "~/lib/deck";

function hasAnyVotes(votes: Record<string, string | null>): boolean {
  return Object.values(votes).some((vote) => vote !== null && vote !== undefined);
}

function RoomStatus({ connected }: { connected: boolean }) {
  return (
    <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center">
      <p className="text-xl font-bold">{connected ? "Loading room..." : "Connecting..."}</p>
    </div>
  );
}

interface ConfirmNameViewProps {
  nameInput: string;
  onNameInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function ConfirmNameView({ nameInput, onNameInputChange, onSubmit }: ConfirmNameViewProps) {
  return (
    <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-6 selection:bg-black selection:text-white">
      <div className="w-full max-w-md border-2 border-black p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Join room</h1>
        <p className="text-sm sm:text-base font-medium mb-4">
          Enter your name before joining this planning session.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label
            htmlFor="room-name"
            className="block text-xs font-bold uppercase tracking-widest"
          >
            Your Name
          </label>
          <input
            id="room-name"
            type="text"
            value={nameInput}
            onChange={(event) => onNameInputChange(event.target.value)}
            placeholder="e.g. Jane Doe"
            className="w-full border-2 border-black p-2.5 sm:p-3 text-base font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-black text-white text-base font-bold uppercase tracking-widest py-2.5 sm:py-3 border-2 border-black hover:bg-white hover:text-black transition-all"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const { roomExists } = useRoomExistence(roomId, navigate);
  const { room, connected, myId, send } = useWebSocket(
    roomExists ? roomId || null : null
  );
  const {
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
  } = useRoomIdentity(roomId);

  const [myVote, setMyVote] = useState<string | null>(null);
  const [joinRequested, setJoinRequested] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const me = room?.participants.find((participant) => participant.participantId === myId);
  const activeMode: ParticipantMode = me?.mode || mode;

  useEffect(() => {
    setMyVote(null);
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

  useEffect(() => {
    if (!room?.currentRound.votes || !myId) {
      return;
    }

    const vote = room.currentRound.votes[myId];
    if (vote === null || vote === undefined) {
      setMyVote(null);
      return;
    }

    if (vote !== "hidden") {
      setMyVote(vote);
    }
  }, [room?.currentRound.votes, myId]);

  useEffect(() => {
    syncFromParticipantName(me?.name);
  }, [me?.name, syncFromParticipantName]);

  const handleConfirmName = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      confirmName();
    },
    [confirmName]
  );

  const handleVote = useCallback(
    (value: CardValue) => {
      if (!myId || room?.currentRound.revealed) {
        return;
      }

      const newVote = myVote === value ? null : value;
      setMyVote(newVote);
      send({ action: "vote", participantId: myId, vote: newVote });
    },
    [myId, room?.currentRound.revealed, myVote, send]
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

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (roomExists !== true || !room) {
    return <RoomStatus connected={connected} />;
  }

  if (identityLoaded && !nameConfirmed) {
    return (
      <ConfirmNameView
        nameInput={nameInput}
        onNameInputChange={setNameInput}
        onSubmit={handleConfirmName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-12">
      <RoomHeader
        title={room.title}
        roomId={roomId || ""}
        userName={me?.name || name}
        onLeave={handleLeave}
        onSetName={handleSetName}
        onSetTitle={handleSetTitle}
      />
      <main className="max-w-6xl mx-auto p-4 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Your Estimate
            </h2>
            <SpectatorToggle mode={activeMode} onToggle={handleSetMode} />
          </div>

          {activeMode === "voter" ? (
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {DECK.map((card) => (
                <VotingCard
                  key={card}
                  value={card}
                  selected={myVote === card}
                  disabled={room.currentRound.revealed}
                  onSelect={handleVote}
                />
              ))}
            </div>
          ) : (
            <p className="text-base font-medium text-gray-500">
              You are watching as a spectator.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <ActionControls
            revealed={room.currentRound.revealed}
            onReveal={handleReveal}
            onReset={handleReset}
            hasVotes={hasAnyVotes(room.currentRound.votes)}
          />
          <ParticipantList
            participants={room.participants}
            revealed={room.currentRound.revealed}
            votes={room.currentRound.votes}
            myId={myId}
            onOpenRemove={() => setRemoveModalOpen(true)}
          />
          {room.currentRound.revealed && (
            <VoteResult participants={room.participants} votes={room.currentRound.votes} />
          )}
          <RevealHistory history={room.history} />
        </div>
      </main>

      <RemoveParticipantsModal
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        participants={room.participants}
        myId={myId}
        onRemove={handleRemoveParticipant}
      />
    </div>
  );
}
