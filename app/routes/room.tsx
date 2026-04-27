import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { Github } from "lucide-react";
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

function playPokeSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore audio errors
  }
}

function getBaseTitle(roomTitle: string | undefined, roomId: string | undefined): string {
  if (roomTitle) {
    return `scrumpkr > ${roomTitle}`;
  }
  if (roomId) {
    return `scrumpkr > ${roomId}`;
  }
  return "scrumpkr.";
}

interface RoomStatusProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

function RoomStatus({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: RoomStatusProps) {
  return (
    <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-6 selection:bg-black selection:text-white">
      <div className="w-full max-w-md border-2 border-black p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">scrumpkr.</p>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-sm font-medium leading-6 text-gray-700">{message}</p>
        {(actionLabel || secondaryActionLabel) && (
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className="flex-1 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-white hover:text-black"
              >
                {actionLabel}
              </button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="flex-1 border-2 border-black px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:bg-black hover:text-white"
              >
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function RoomBanner({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-4 lg:px-8">
      <div className="border-2 border-black bg-gray-50 px-4 py-3 text-sm font-medium text-black" role="alert">
        {message}
      </div>
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
  const pokeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomTitleRef = useRef<string | undefined>(undefined);

  const handlePoke = useCallback(
    (fromName: string) => {
      playPokeSound();
      if (pokeIntervalRef.current) {
        clearInterval(pokeIntervalRef.current);
      }
      const baseTitle = getBaseTitle(roomTitleRef.current, roomId);
      let count = 0;
      pokeIntervalRef.current = setInterval(() => {
        document.title =
          count % 2 === 0 ? `📢 ${fromName} poked you!` : baseTitle;
        count++;
        if (count >= 6) {
          if (pokeIntervalRef.current) {
            clearInterval(pokeIntervalRef.current);
            pokeIntervalRef.current = null;
          }
          document.title = baseTitle;
        }
      }, 500);
    },
    [roomId]
  );

  useEffect(() => {
    return () => {
      if (pokeIntervalRef.current) {
        clearInterval(pokeIntervalRef.current);
      }
    };
  }, []);

  const { roomExists, lookupError, retryLookup } = useRoomExistence(roomId, navigate);
  const {
    room,
    connected,
    myId,
    send,
    actionError,
    connectionError,
    isReconnecting,
    retryConnection,
  } = useWebSocket(roomExists ? roomId || null : null, handlePoke);

  roomTitleRef.current = room?.title;
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
    if (pokeIntervalRef.current) return;
    document.title = getBaseTitle(room?.title, roomId);
  }, [room?.title, roomId]);

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
      if (!myId) return;
      send({ action: "poke", participantId: myId, targetId });
    },
    [myId, send]
  );

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (lookupError) {
    return (
      <RoomStatus
        title="Room unavailable"
        message={lookupError}
        actionLabel="Try Again"
        onAction={retryLookup}
        secondaryActionLabel="Back Home"
        onSecondaryAction={handleLeave}
      />
    );
  }

  if (roomExists !== true) {
    return (
      <RoomStatus
        title="Checking room"
        message="Making sure this room is ready before you join."
      />
    );
  }

  if (connectionError) {
    return (
      <RoomStatus
        title="Unable to join room"
        message={connectionError}
        actionLabel="Try Again"
        onAction={retryConnection}
        secondaryActionLabel="Back Home"
        onSecondaryAction={handleLeave}
      />
    );
  }

  if (!room) {
    return (
      <RoomStatus
        title={connected ? "Loading room" : isReconnecting ? "Reconnecting" : "Connecting"}
        message={
          isReconnecting
            ? "Connection dropped. Reconnecting you to the room now."
            : connected
              ? "Syncing the latest room state."
              : "Opening a live connection to this room."
        }
      />
    );
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
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white flex flex-col">
      {isReconnecting ? (
        <RoomBanner message="Connection lost. Reconnecting to the room..." />
      ) : null}
      {actionError ? <RoomBanner message={actionError} /> : null}
      <RoomHeader
        title={room.title}
        roomId={roomId || ""}
        userName={me?.name || name}
        onLeave={handleLeave}
        onSetName={handleSetName}
        onSetTitle={handleSetTitle}
      />
      <main className="flex-1 max-w-6xl mx-auto p-4 lg:py-8 mt-3 lg:mt-8 grid content-start grid-cols-1 lg:grid-cols-3 gap-8 w-full">
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

          <div className="lg:hidden">
            <ActionControls
              revealed={room.currentRound.revealed}
              onReveal={handleReveal}
              onReset={handleReset}
              hasVotes={hasAnyVotes(room.currentRound.votes)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="hidden lg:block">
            <ActionControls
              revealed={room.currentRound.revealed}
              onReveal={handleReveal}
              onReset={handleReset}
              hasVotes={hasAnyVotes(room.currentRound.votes)}
            />
          </div>
          <ParticipantList
            participants={room.participants}
            revealed={room.currentRound.revealed}
            votes={room.currentRound.votes}
            myId={myId}
            onOpenRemove={() => setRemoveModalOpen(true)}
            onPoke={handleSendPoke}
          />
          {room.currentRound.revealed && (
            <VoteResult participants={room.participants} votes={room.currentRound.votes} />
          )}
          <RevealHistory history={room.history} onClear={handleClearHistory} />
        </div>
      </main>

      <RemoveParticipantsModal
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        participants={room.participants}
        myId={myId}
        onRemove={handleRemoveParticipant}
      />

      <footer className="mt-auto border-t-2 border-black bg-white sticky bottom-0">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Free · No Tracker · No Login · No Ads · No Bullsh!t
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/xreal/scrumpkr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-black transition-colors cursor-pointer"
              aria-label="View source on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="/"
              className="text-xs font-black tracking-tighter hover:opacity-60 transition-opacity cursor-pointer"
            >
              scrumpkr.
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
