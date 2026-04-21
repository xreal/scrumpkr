import { computeAverage } from "~/lib/deck";
import type { Participant } from "~/lib/types";

interface VoteResultProps {
  participants: Participant[];
  votes: Record<string, string | null>;
}

export function VoteResult({ participants, votes }: VoteResultProps) {
  const voterVotes = participants
    .filter((p) => p.mode === "voter")
    .map((p) => votes[p.participantId] ?? null);

  const average = computeAverage(voterVotes);

  return (
    <div className="flex justify-between items-center -mt-2">
      <span className="text-base font-black uppercase tracking-widest">
        Average
      </span>
      <span className="text-xl sm:text-2xl font-black bg-black text-white px-2 sm:px-3 py-1">
        {average}
      </span>
    </div>
  );
}
