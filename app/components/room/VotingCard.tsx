import { Coffee } from "lucide-react";
import type { CardValue } from "~/lib/deck";

interface VotingCardProps {
  value: CardValue;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function VotingCard({ value, selected, disabled, onSelect }: VotingCardProps) {
  return (
    <button
      onClick={() => onSelect(value)}
      disabled={disabled}
      className={`
        aspect-[3/4] flex items-center justify-center border-2 border-black text-2xl font-black transition-all
        ${disabled && !selected ? "opacity-30 cursor-not-allowed" : ""}
        ${selected
          ? "bg-black text-white translate-x-0.5 translate-y-0.5 shadow-none"
          : "bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"}
      `}
    >
      {value === "coffee" ? <Coffee size={24} strokeWidth={3} /> : value}
    </button>
  );
}
