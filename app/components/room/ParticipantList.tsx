import { Coffee, UserMinus } from "lucide-react";
import type { Participant } from "~/lib/types";

interface ParticipantListProps {
  participants: Participant[];
  revealed: boolean;
  votes: Record<string, string | null>;
  myId: string | null;
  onOpenRemove: () => void;
}

export function ParticipantList({
  participants,
  revealed,
  votes,
  myId,
  onOpenRemove,
}: ParticipantListProps) {
  return (
    <div className="border-2 border-black p-4">
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3 gap-2">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-widest">
          Participants
        </h3>
        <button
          onClick={onOpenRemove}
          className="flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors flex-shrink-0"
          title="Remove participants"
        >
          <UserMinus size={14} />
          -
        </button>
      </div>
      <ul className="space-y-2">
        {participants.map((p) => {
          const vote = votes[p.participantId];
          const isMe = p.participantId === myId;
          const hasVoted = vote !== null && vote !== undefined;
          const isHidden = vote === "hidden";

          return (
            <li
              key={p.participantId}
              className="flex items-center justify-between gap-2 text-sm font-bold"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-block h-2 w-2 rounded-full border border-black flex-shrink-0 ${
                    p.connected ? "bg-green-500" : "bg-gray-400"
                  }`}
                  title={p.connected ? "Online" : "Inactive"}
                />
                <span
                  className={`truncate ${
                    isMe ? "underline decoration-2 underline-offset-2" : ""
                  }`}
                  title={p.name}
                >
                  {p.name}
                  {isMe ? " (You)" : ""}
                </span>
                {p.mode === "spectator" && (
                  <span className="text-xs font-medium bg-gray-200 px-1.5 py-0.5 flex-shrink-0">
                    Spectator
                  </span>
                )}
              </span>
              <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 border-2 border-black bg-gray-50 text-xs sm:text-sm font-black flex-shrink-0">
                {revealed
                  ? vote === "coffee"
                    ? <Coffee size={16} />
                    : hasVoted && !isHidden
                      ? vote
                      : "—"
                  : hasVoted
                    ? "✓"
                    : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
