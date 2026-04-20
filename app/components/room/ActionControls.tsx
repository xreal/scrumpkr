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
        className="w-full flex items-center justify-center gap-3 bg-black text-white text-2xl font-bold uppercase tracking-widest py-6 border-4 border-black hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-40 disabled:pointer-events-none"
      >
        <Eye size={28} />
        Reveal
      </button>
    );
  }

  return (
    <button
      onClick={onReset}
      className="w-full flex items-center justify-center gap-3 bg-white text-black text-2xl font-bold uppercase tracking-widest py-6 border-4 border-black transition-all shadow-[6px_6px_0px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
    >
      <RefreshCw size={28} />
      New Round
    </button>
  );
}
