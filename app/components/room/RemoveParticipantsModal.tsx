import { X } from "lucide-react";
import type { Participant } from "~/lib/types";

interface RemoveParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  myId: string | null;
  onRemove: (participantId: string) => void;
}

export function RemoveParticipantsModal({
  isOpen,
  onClose,
  participants,
  myId,
  onRemove,
}: RemoveParticipantsModalProps) {
  if (!isOpen) return null;

  const removable = participants.filter((p) => p.participantId !== myId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white border-2 border-black w-full max-w-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between border-b-2 border-black p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-widest">
            Remove Participants
          </h3>
          <button
            onClick={onClose}
            className="hover:opacity-60 transition-opacity flex-shrink-0"
            title="Close"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>
        <div className="p-3 sm:p-4">
          {removable.length === 0 ? (
            <p className="text-sm text-gray-500 font-medium">
              No participants available to remove.
            </p>
          ) : (
            <ul className="space-y-2">
              {removable.map((p) => (
                <li
                  key={p.participantId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-bold truncate">
                    {p.name} {!p.connected ? "(Offline)" : ""}
                  </span>
                  <button
                    onClick={() => {
                      onRemove(p.participantId);
                      onClose();
                    }}
                    className="flex-shrink-0 border-2 border-black px-2 py-0.5 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
