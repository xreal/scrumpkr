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
        h-14 sm:h-16 md:h-20 w-full flex items-center justify-center border-2 border-black text-xl sm:text-2xl font-black transition-all
        ${disabled && !selected ? "opacity-30 cursor-not-allowed" : ""}
        ${selected
          ? "bg-black text-white translate-x-0.5 translate-y-0.5 shadow-none active:opacity-80"
          : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"}
      `}
    >
      {value === "coffee" ? <Coffee size={20} strokeWidth={3} className="sm:w-6 sm:h-6" /> : value}
    </button>
  );
}
