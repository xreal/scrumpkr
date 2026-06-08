import { useState } from "react";
import { X } from "lucide-react";
import type { Participant } from "~/lib/types";

interface RemoveParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  myId: string | null;
  onRemove: (participantIds: string[]) => void;
}

export function RemoveParticipantsModal({
  isOpen,
  onClose,
  participants,
  myId,
  onRemove,
}: RemoveParticipantsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const removable = participants.filter((p) => p.participantId !== myId);

  const toggleSelected = (participantId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  };

  const handleRemoveSelected = () => {
    if (selectedIds.size === 0) {
      return;
    }

    onRemove([...selectedIds]);
    setSelectedIds(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white border-2 border-black w-full max-w-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between border-b-2 border-black p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-widest">
            Remove Participants
          </h3>
          <button
            onClick={handleClose}
            className="hover:opacity-60 transition-opacity shrink-0"
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
            <>
              <ul className="space-y-2">
                {removable.map((p) => (
                  <li key={p.participantId}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.participantId)}
                        onChange={() => toggleSelected(p.participantId)}
                        className="h-4 w-4 border-2 border-black accent-black shrink-0"
                      />
                      <span className="text-sm font-bold truncate">
                        {p.name} {!p.connected ? "(Inactive)" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleRemoveSelected}
                disabled={selectedIds.size === 0}
                className="mt-4 w-full border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-inherit"
              >
                Remove selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
