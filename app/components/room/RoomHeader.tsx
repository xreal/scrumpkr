import { LogOut, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "~/components/ui/CopyButton";

interface RoomHeaderProps {
  title: string;
  roomId: string;
  userName: string;
  onLeave: () => void;
  onSetName: (name: string) => void;
  onSetTitle: (title: string) => void;
}

export function RoomHeader({
  title,
  roomId,
  userName,
  onLeave,
  onSetName,
  onSetTitle,
}: RoomHeaderProps) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}` : "";
  const [titleDraft, setTitleDraft] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [nameDraft, setNameDraft] = useState(userName);
  const [isEditingName, setIsEditingName] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(title);
    }
  }, [title, isEditingTitle]);

  useEffect(() => {
    if (!isEditingName) {
      setNameDraft(userName);
    }
  }, [userName, isEditingName]);

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

  const commitNameChange = useCallback(
    (nextName: string) => {
      const trimmed = nextName.trim();
      setIsEditingName(false);
      if (!trimmed) {
        setNameDraft(userName);
        return;
      }
      if (trimmed !== userName) {
        onSetName(trimmed);
      }
      setNameDraft(trimmed);
    },
    [onSetName, userName]
  );

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitNameChange(nameDraft);
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        setIsEditingName(false);
        setNameDraft(userName);
        event.currentTarget.blur();
      }
    },
    [commitNameChange, nameDraft, userName]
  );

  return (
    <header className="border-b-2 border-black">
      <div className="max-w-6xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 sm:gap-6 w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={onLeave}
            className="text-lg sm:text-2xl font-black tracking-tighter hover:opacity-60 transition-opacity flex-shrink-0 cursor-pointer"
            title="Back to startpage"
          >
            scrumpkr.
          </button>
          <div className="h-6 w-0.5 bg-black hidden sm:block" />
          <div className="flex items-center border-2 border-black font-bold min-w-0 flex-1 max-w-[500px] h-10 sm:h-11">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Room title..."
              className="bg-transparent border-none outline-none font-bold text-sm sm:text-base flex-1 min-w-0 px-2 sm:px-3"
            />
            <div className="h-full border-l-2 border-black flex items-center justify-center px-1 sm:px-1.5">
              <CopyButton text={shareUrl} label="Copy share link" />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative flex-shrink-0 w-28 sm:w-40 md:w-48">
            <User
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => {
                setIsEditingName(true);
                setNameDraft(e.target.value);
              }}
              onBlur={() => commitNameChange(nameDraft)}
              onKeyDown={handleNameKeyDown}
              placeholder="Your name"
              aria-label="Your name"
              className="border-2 border-black pl-7 pr-2 sm:pr-3 h-10 sm:h-11 text-xs sm:text-sm font-bold tracking-wide w-full focus:outline-none"
            />
          </div>
          <button
            onClick={onLeave}
            className="flex items-center justify-center gap-2 border-2 border-black h-10 sm:h-11 w-10 sm:w-auto sm:px-3 text-xs sm:text-sm hover:bg-black hover:text-white transition-colors flex-shrink-0 cursor-pointer"
            title="Leave room"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
        </div>
      </div>
    </header>
  );
}
