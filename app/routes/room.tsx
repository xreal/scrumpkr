import { DECK, type CardValue } from "~/lib/deck";
import { VotingCard } from "~/components/room/VotingCard";
import { ParticipantList } from "~/components/room/ParticipantList";
import { ActionControls } from "~/components/room/ActionControls";
import { VoteResult } from "~/components/room/VoteResult";
import { RevealHistory } from "~/components/room/RevealHistory";
import { RoomHeader } from "~/components/room/RoomHeader";
import { SpectatorToggle } from "~/components/room/SpectatorToggle";
import { RemoveParticipantsModal } from "~/components/room/RemoveParticipantsModal";
import { useWebSocket } from "~/hooks/useWebSocket";
import {
  getDisplayName,
  setDisplayName,
  getPreferredMode,
  setPreferredMode,
} from "~/lib/storage";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { room, connected, myId, send } = useWebSocket(roomId || null);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [mode, setMode] = useState<"voter" | "spectator">("voter");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  useEffect(() => {
    setIdentityLoaded(false);
    setName("");
    setNameInput("");
    setNameConfirmed(false);
    setMode("voter");
    setMyVote(null);
    setJoined(false);

    const storedName = getDisplayName(roomId || null);
    if (storedName) {
      setName(storedName);
      setNameInput(storedName);
      setNameConfirmed(true);
    }
    const storedMode = getPreferredMode(roomId || null);
    if (storedMode) setMode(storedMode);
    setIdentityLoaded(true);
  }, [roomId]);

  const me = room?.participants.find((p) => p.participantId === myId);

  useEffect(() => {
    if (!room || !myId || joined || !identityLoaded || !nameConfirmed) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const isRejoin = room.participants.some((p) => p.participantId === myId);
    if (isRejoin) {
      send({ action: "rejoin", participantId: myId, name: trimmedName });
    } else {
      send({ action: "join", participantId: myId, name: trimmedName, mode });
    }
    setJoined(true);
  }, [room, myId, joined, identityLoaded, nameConfirmed, name, mode, send]);

  const handleConfirmName = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = nameInput.trim();
      if (!trimmedName) return;
      setDisplayName(trimmedName, roomId || null);
      setName(trimmedName);
      setNameConfirmed(true);
    },
    [nameInput, roomId]
  );

  useEffect(() => {
    if (room?.currentRound.votes && myId) {
      const vote = room.currentRound.votes[myId];
      if (vote === null || vote === undefined) {
        setMyVote(null);
      } else if (vote !== "hidden") {
        setMyVote(vote);
      }
    }
  }, [room?.currentRound.votes, myId]);

  const handleVote = useCallback(
    (value: CardValue) => {
      if (!myId || room?.currentRound.revealed) return;
      const newVote = myVote === value ? null : value;
      setMyVote(newVote);
      send({ action: "vote", participantId: myId, vote: newVote });
    },
    [myId, myVote, room?.currentRound.revealed, send]
  );

  const handleReveal = useCallback(() => {
    if (!myId) return;
    send({ action: "reveal", participantId: myId });
  }, [myId, send]);

  const handleReset = useCallback(() => {
    if (!myId) return;
    setMyVote(null);
    send({ action: "reset_round", participantId: myId });
  }, [myId, send]);

  const handleSetName = useCallback(
    (newName: string) => {
      if (!myId) return;
      const trimmedName = newName.trim();
      if (!trimmedName) return;
      setName(trimmedName);
      setNameInput(trimmedName);
      setDisplayName(trimmedName, roomId || null);
      send({ action: "set_name", participantId: myId, name: trimmedName });
    },
    [myId, roomId, send]
  );

  const handleSetMode = useCallback(
    (newMode: "voter" | "spectator") => {
      if (!myId) return;
      setMode(newMode);
      setPreferredMode(newMode, roomId || null);
      send({ action: "set_mode", participantId: myId, mode: newMode });
    },
    [myId, roomId, send]
  );

  const handleSetTitle = useCallback(
    (title: string) => {
      if (!myId) return;
      send({ action: "set_title", participantId: myId, title });
    },
    [myId, send]
  );

  const handleRemoveParticipant = useCallback(
    (removeId: string) => {
      if (!myId) return;
      send({ action: "remove_participant", participantId: myId, removeId });
    },
    [myId, send]
  );

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    if (!me?.name) return;
    setName(me.name);
    setNameInput(me.name);
  }, [me?.name]);

  if (!room) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center">
        <p className="text-xl font-bold">
          {connected ? "Loading room..." : "Connecting..."}
        </p>
      </div>
    );
  }

  const hasVotes = Object.values(room.currentRound.votes).some(
    (v) => v !== null && v !== undefined
  );

  if (identityLoaded && !nameConfirmed) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-6 selection:bg-black selection:text-white">
        <div className="w-full max-w-md border-2 border-black p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Join room</h1>
          <p className="text-sm sm:text-base font-medium mb-4">
            Enter your name before joining this planning session.
          </p>
          <form onSubmit={handleConfirmName} className="space-y-4">
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
              onChange={(e) => setNameInput(e.target.value)}
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
            <SpectatorToggle mode={me?.mode || mode} onToggle={handleSetMode} />
          </div>
          {(me?.mode || mode) === "voter" ? (
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
            hasVotes={hasVotes}
          />
          <ParticipantList
            participants={room.participants}
            revealed={room.currentRound.revealed}
            votes={room.currentRound.votes}
            myId={myId}
            onOpenRemove={() => setRemoveModalOpen(true)}
          />
          {room.currentRound.revealed && (
            <VoteResult
              participants={room.participants}
              votes={room.currentRound.votes}
            />
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
