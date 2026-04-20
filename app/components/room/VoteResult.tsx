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
    <div className="mt-8 pt-6 border-t-4 border-black flex justify-between items-center">
      <span className="text-xl font-black uppercase tracking-widest">
        Average
      </span>
      <span className="text-4xl font-black bg-black text-white px-4 py-2">
        {average}
      </span>
    </div>
  );
}
