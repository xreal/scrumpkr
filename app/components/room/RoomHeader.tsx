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
    <header className="border-b-4 border-black p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-black tracking-tighter">scrumpkr.</h1>
        <div className="h-8 w-1 bg-black hidden sm:block" />
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
        <span className="uppercase tracking-widest">{userName}</span>
        <button
          onClick={onLeave}
          className="flex items-center gap-2 border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Leave
        </button>
      </div>
    </header>
  );
}
