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
        aspect-[3/4] flex items-center justify-center border-4 border-black text-4xl font-black transition-all
        ${disabled && !selected ? "opacity-30 cursor-not-allowed" : ""}
        ${selected
          ? "bg-black text-white translate-x-1 translate-y-1 shadow-none"
          : "bg-white text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"}
      `}
    >
      {value === "coffee" ? <Coffee size={40} strokeWidth={3} /> : value}
    </button>
  );
}
