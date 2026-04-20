import { useState, useEffect } from "react";
import { getDisplayName } from "~/lib/storage";

interface JoinFormProps {
  onSubmit: (name: string, roomId?: string) => void;
  lastRoom?: string | null;
  onRejoinLast?: (name: string) => void;
}

export function JoinForm({ onSubmit, lastRoom, onRejoinLast }: JoinFormProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const stored = getDisplayName();
    if (stored) setName(stored);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), roomCode.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-base font-bold uppercase tracking-widest text-black"
        >
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jane Doe"
          className="w-full border-2 border-black p-3 text-base font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
          required
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="room"
          className="block text-base font-bold uppercase tracking-widest text-black"
        >
          Room Code
        </label>
        <input
          id="room"
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="Leave empty for new room"
          className="w-full border-2 border-black p-3 text-base font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-black text-white text-lg font-bold uppercase tracking-widest py-4 border-2 border-black hover:bg-white hover:text-black transition-all active:translate-y-0.5"
      >
        {roomCode ? "Join Room" : "Create Room"}
      </button>
      {lastRoom && onRejoinLast && (
        <button
          type="button"
          onClick={() => onRejoinLast(name)}
          className="w-full border-2 border-black py-3 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all"
        >
          Rejoin last room ({lastRoom})
        </button>
      )}
    </form>
  );
}
