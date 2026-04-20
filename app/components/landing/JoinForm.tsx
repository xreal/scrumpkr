interface JoinFormProps {
  onSubmit: (name: string, roomId?: string) => void;
}

import { useState, useEffect } from "react";
import { getDisplayName } from "~/lib/storage";

export function JoinForm({ onSubmit }: JoinFormProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    const stored = getDisplayName();
    if (stored) setName(stored);
  }, []);
  const [roomCode, setRoomCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), roomCode.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-xl font-bold uppercase tracking-widest text-black"
        >
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jane Doe"
          className="w-full border-4 border-black p-4 text-xl font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
          required
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="room"
          className="block text-xl font-bold uppercase tracking-widest text-black"
        >
          Room Code
        </label>
        <input
          id="room"
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="Leave empty for new room"
          className="w-full border-4 border-black p-4 text-xl font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-black text-white text-2xl font-bold uppercase tracking-widest py-6 border-4 border-black hover:bg-white hover:text-black transition-all active:translate-y-1"
      >
        {roomCode ? "Join Room" : "Create Room"}
      </button>
    </form>
  );
}
