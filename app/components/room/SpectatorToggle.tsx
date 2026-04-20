import { Eye } from "lucide-react";

interface SpectatorToggleProps {
  mode: "voter" | "spectator";
  onToggle: (mode: "voter" | "spectator") => void;
}

export function SpectatorToggle({ mode, onToggle }: SpectatorToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={mode === "spectator"}
        onChange={(e) => onToggle(e.target.checked ? "spectator" : "voter")}
        className="sr-only"
      />
      <span
        className={`flex items-center gap-2 border-2 border-black px-3 py-1.5 font-bold transition-colors ${
          mode === "spectator"
            ? "bg-black text-white"
            : "bg-white text-black hover:bg-gray-100"
        }`}
      >
        <Eye size={16} />
        Spectator
      </span>
    </label>
  );
}
