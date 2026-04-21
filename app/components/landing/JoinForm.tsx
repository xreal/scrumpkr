import { useState, useEffect } from "react";
import { getDisplayName } from "~/lib/storage";

interface JoinFormProps {
  onSubmit: (name: string, roomId?: string) => void;
  lastRoom?: string | null;
  onRejoinLast?: (name: string) => void;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export function JoinForm({
  onSubmit,
  lastRoom,
  onRejoinLast,
  errorMessage,
  onClearError,
}: JoinFormProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const stored = getDisplayName();
    if (stored) setName(stored);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onClearError?.();
    onSubmit(name.trim(), roomCode.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-sm sm:text-base font-bold uppercase tracking-widest text-black"
        >
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            onClearError?.();
            setName(e.target.value);
          }}
          placeholder="e.g. Jane Doe"
          className="w-full border-2 border-black p-2.5 sm:p-3 text-base font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
          required
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="room"
          className="block text-sm sm:text-base font-bold uppercase tracking-widest text-black"
        >
          Room Code
        </label>
        <input
          id="room"
          type="text"
          value={roomCode}
          onChange={(e) => {
            onClearError?.();
            setRoomCode(e.target.value);
          }}
          placeholder="Leave empty for new room"
          className="w-full border-2 border-black p-2.5 sm:p-3 text-base font-medium focus:outline-none focus:ring-0 focus:bg-gray-50 transition-colors"
        />
        {errorMessage && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="w-full bg-black text-white text-base sm:text-lg font-bold uppercase tracking-widest py-3 sm:py-4 border-2 border-black hover:bg-white hover:text-black transition-all active:translate-y-0.5 cursor-pointer"
      >
        {roomCode ? "Join Room" : "Create Room"}
      </button>
      {lastRoom && onRejoinLast && (
        <button
          type="button"
          onClick={() => onRejoinLast(name)}
          className="w-full border-2 border-black py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all cursor-pointer"
        >
          Rejoin last room ({lastRoom})
        </button>
      )}
    </form>
  );
}
