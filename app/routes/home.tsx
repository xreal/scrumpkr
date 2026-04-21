import { JoinForm } from "~/components/landing/JoinForm";
import { setDisplayName, setLastRoom, getLastRoom } from "~/lib/storage";
import { useNavigate } from "react-router";
import { Github } from "lucide-react";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "scrumpkr. — Minimalist Planning Poker" },
    { name: "description", content: "No-login planning poker for teams. Create a room, share the link, start estimating." },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const lastRoom = getLastRoom();

  const handleJoin = async (name: string, existingRoomId?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setDisplayName(trimmedName);

    if (existingRoomId) {
      const roomId = existingRoomId.trim();
      setDisplayName(trimmedName, roomId);
      setLastRoom(roomId);
      navigate(`/room/${roomId}`);
      return;
    }

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const roomId = res.headers.get("X-Room-Id");
    if (roomId) {
      setDisplayName(trimmedName, roomId);
      setLastRoom(roomId);
      navigate(`/room/${roomId}`);
    }
  };

  const handleRejoinLast = (name: string) => {
    if (!lastRoom) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setDisplayName(trimmedName, lastRoom);
    setLastRoom(lastRoom);
    navigate(`/room/${lastRoom}`);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-black selection:text-white">
      <div className="w-full max-w-md">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-2">
          scrumpkr.
        </h1>
        <p className="text-base sm:text-lg font-medium mb-8 sm:mb-12">
          Minimalist story point estimation.
        </p>
        <JoinForm onSubmit={handleJoin} lastRoom={lastRoom} onRejoinLast={handleRejoinLast} />
        <div className="mt-8 sm:mt-12 flex flex-col items-center gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            No Tracker · No Personal Data · No Ads
          </p>
          <a
            href="https://github.com/xreal/scrumpkr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black hover:text-gray-600 transition-colors"
            aria-label="View source on GitHub"
          >
            <Github className="w-5 h-5" />
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
