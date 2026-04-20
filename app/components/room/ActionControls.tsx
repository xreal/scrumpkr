import { Eye, RefreshCw } from "lucide-react";

interface ActionControlsProps {
  revealed: boolean;
  onReveal: () => void;
  onReset: () => void;
  hasVotes: boolean;
}

export function ActionControls({ revealed, onReveal, onReset, hasVotes }: ActionControlsProps) {
  if (!revealed) {
    return (
      <button
        onClick={onReveal}
        disabled={!hasVotes}
        className="w-full flex items-center justify-center gap-2 bg-black text-white text-lg font-bold uppercase tracking-widest py-3 border-2 border-black hover:bg-white hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-40 disabled:pointer-events-none"
      >
        <Eye size={20} />
        Reveal
      </button>
    );
  }

  return (
    <button
      onClick={onReset}
      className="w-full flex items-center justify-center gap-2 bg-white text-black text-lg font-bold uppercase tracking-widest py-3 border-2 border-black transition-all shadow-[4px_4px_0px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
    >
      <RefreshCw size={20} />
      New Round
    </button>
  );
}
