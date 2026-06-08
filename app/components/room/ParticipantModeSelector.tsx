import { Eye, Monitor, Users } from "lucide-react";
import type { ParticipantViewMode } from "~/lib/participant-view-mode";

interface ParticipantModeSelectorProps {
  mode: ParticipantViewMode;
  onChange: (mode: ParticipantViewMode) => void;
}

const MODE_OPTIONS: Array<{
  value: ParticipantViewMode;
  label: string;
  shortLabel: string;
  icon: typeof Users;
  title: string;
}> = [
  {
    value: "voter",
    label: "Voter",
    shortLabel: "Vote",
    icon: Users,
    title: "Vote by selecting a card",
  },
  {
    value: "presenter",
    label: "Presenter",
    shortLabel: "Present",
    icon: Monitor,
    title: "Vote by typing — your estimate stays hidden on screen",
  },
  {
    value: "spectator",
    label: "Spectator",
    shortLabel: "Watch",
    icon: Eye,
    title: "Watch without voting",
  },
];

export function ParticipantModeSelector({ mode, onChange }: ParticipantModeSelectorProps) {
  return (
    <div
      className="flex border-2 border-black"
      role="radiogroup"
      aria-label="Participation mode"
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer border-r-2 border-black last:border-r-0 ${
              isActive
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            <Icon size={14} className="shrink-0" />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
