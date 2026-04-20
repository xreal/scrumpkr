import { Coffee } from "lucide-react";
import type { Participant } from "~/lib/types";

interface ParticipantListProps {
  participants: Participant[];
  revealed: boolean;
  votes: Record<string, string | null>;
  myId: string | null;
  onRemove: (participantId: string) => void;
}

export function ParticipantList({
  participants,
  revealed,
  votes,
  myId,
  onRemove,
}: ParticipantListProps) {
  return (
    <div className="border-4 border-black p-6">
      <h3 className="text-2xl font-black uppercase tracking-widest border-b-4 border-black pb-4 mb-4">
        Participants
      </h3>
      <ul className="space-y-4">
        {participants.map((p) => {
          const vote = votes[p.participantId];
          const isMe = p.participantId === myId;
          const hasVoted = vote !== null && vote !== undefined;
          const isHidden = vote === "hidden";

          return (
            <li
              key={p.participantId}
              className="flex justify-between items-center text-xl font-bold"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full border border-black ${
                    p.connected ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={p.connected ? "Online" : "Offline"}
                />
                <span
                  className={
                    isMe
                      ? "underline decoration-4 underline-offset-4"
                      : ""
                  }
                >
                  {p.name}
                  {isMe ? " (You)" : ""}
                </span>
                {p.mode === "spectator" && (
                  <span className="text-sm font-medium bg-gray-200 px-2 py-0.5">
                    Spectator
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="flex items-center justify-center w-12 h-12 border-2 border-black bg-gray-50">
                  {revealed
                    ? vote === "coffee"
                      ? <Coffee size={24} />
                      : hasVoted && !isHidden
                        ? vote
                        : "—"
                    : hasVoted && !isHidden
                      ? "✓"
                      : ""}
                </span>
                {!isMe && (
                  <button
                    onClick={() => onRemove(p.participantId)}
                    className="text-sm text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove participant"
                  >
                    ×
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
