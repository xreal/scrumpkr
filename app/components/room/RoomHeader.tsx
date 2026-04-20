import { LogOut } from "lucide-react";
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

  return (
    <header className="border-b-2 border-black p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onLeave}
          className="text-2xl font-black tracking-tighter hover:opacity-60 transition-opacity"
          title="Back to startpage"
        >
          scrumpkr.
        </button>
        <div className="h-6 w-0.5 bg-black hidden sm:block" />
        <div className="flex items-center gap-2 border-2 border-black px-3 py-1 font-bold">
          <input
            type="text"
            value={title}
            onChange={(e) => onSetTitle(e.target.value)}
            placeholder="Room title..."
            className="bg-transparent border-none outline-none font-bold w-32"
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
