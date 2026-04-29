import { Check } from "lucide-react";
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
        relative h-14 sm:h-16 md:h-20 w-full flex items-center justify-center border-2 border-black text-xl sm:text-2xl font-black transition-all cursor-pointer
        ${disabled && !selected ? "opacity-30 cursor-not-allowed" : ""}
        ${selected
          ? "bg-black text-white shadow-none"
          : "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:bg-gray-100"}
      `}
    >
      {selected && (
        <span className="absolute top-1 right-1">
          <Check size={14} strokeWidth={3} className="text-white sm:w-4 sm:h-4" />
        </span>
      )}
      {value}
    </button>
  );
}
