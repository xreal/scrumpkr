import { LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "~/components/ui/CopyButton";

interface RoomHeaderProps {
  title: string;
  roomId: string;
  userName: string;
  onLeave: () => void;
  onSetTitle: (title: string) => void;
}

export function RoomHeader({ title, roomId, userName, onLeave, onSetTitle }: RoomHeaderProps) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}` : "";
  const [titleDraft, setTitleDraft] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(title);
    }
  }, [title, isEditingTitle]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const flushTitleUpdate = useCallback(
    (nextTitle: string) => {
      onSetTitle(nextTitle);
    },
    [onSetTitle]
  );

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setIsEditingTitle(true);
      setTitleDraft(nextTitle);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        flushTitleUpdate(nextTitle);
      }, 180);
    },
    [flushTitleUpdate]
  );

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    flushTitleUpdate(titleDraft);
  }, [flushTitleUpdate, titleDraft]);

  return (
    <header className="border-b-2 border-black p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onLeave}
          className="text-xl sm:text-2xl font-black tracking-tighter hover:opacity-60 transition-opacity"
          title="Back to startpage"
        >
          scrumpkr.
        </button>
        <div className="h-6 w-0.5 bg-black hidden sm:block" />
        <div className="flex items-center gap-2 border-2 border-black px-2 sm:px-3 py-1 font-bold min-w-0">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Room title..."
            className="bg-transparent border-none outline-none font-bold w-20 sm:w-32 md:w-48 min-w-0"
          />
          <CopyButton text={shareUrl} label="Copy share link" />
        </div>
      </div>
      <div className="flex items-center gap-4 font-bold">
        <span className="uppercase tracking-widest text-sm">{userName}</span>
        <button
          onClick={onLeave}
          className="flex items-center gap-2 border-2 border-black px-3 py-1.5 text-sm hover:bg-black hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Leave
        </button>
      </div>
    </header>
  );
}
