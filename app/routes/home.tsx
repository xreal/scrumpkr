import { JoinForm } from "~/components/landing/JoinForm";
import {
  setDisplayName,
  setLastRoom as persistLastRoom,
  getLastRoom,
} from "~/lib/storage";
import {
  ROOM_NOT_FOUND_MESSAGE,
  getJoinErrorMessageFromSearch,
} from "~/lib/room-join";
import { useNavigate, useLocation } from "react-router";
import { Github } from "lucide-react";
import { useEffect, useState } from "react";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "scrumpkr.net -> Your minimal Scrum Poker App" },
    { name: "description", content: "No-login planning poker for teams. Create a room, share the link, start estimating." },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [lastRoomTitle, setLastRoomTitle] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    setJoinError(getJoinErrorMessageFromSearch(location.search));
  }, [location.search]);

  useEffect(() => {
    const storedRoom = getLastRoom();
    setLastRoom(storedRoom);

    if (storedRoom) {
      fetch(`/api/rooms/exists?roomId=${encodeURIComponent(storedRoom)}`)
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as { title?: string | null };
          if (payload.title) {
            setLastRoomTitle(payload.title);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleJoin = async (name: string, existingRoomId?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setDisplayName(trimmedName);

    if (existingRoomId) {
      const roomId = existingRoomId.trim();
      if (!roomId) return;

      const existsResponse = await fetch(
        `/api/rooms/exists?roomId=${encodeURIComponent(roomId)}`
      );
      if (!existsResponse.ok) {
        setJoinError(ROOM_NOT_FOUND_MESSAGE);
        return;
      }

      const payload = (await existsResponse.json()) as { exists?: boolean };
      if (!payload.exists) {
        setJoinError(ROOM_NOT_FOUND_MESSAGE);
        return;
      }

      setJoinError(null);
      setDisplayName(trimmedName, roomId);
      persistLastRoom(roomId);
      navigate(`/room/${roomId}`);
      return;
    }

    setJoinError(null);

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const roomId = res.headers.get("X-Room-Id");
    if (roomId) {
      setDisplayName(trimmedName, roomId);
      persistLastRoom(roomId);
      navigate(`/room/${roomId}`);
    }
  };

  const handleRejoinLast = (name: string) => {
    if (!lastRoom) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setDisplayName(trimmedName, lastRoom);
    persistLastRoom(lastRoom);
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
        <JoinForm
          onSubmit={handleJoin}
          lastRoom={lastRoom}
          lastRoomTitle={lastRoomTitle}
          onRejoinLast={handleRejoinLast}
          errorMessage={joinError}
          onClearError={() => setJoinError(null)}
        />
        <div className="mt-8 sm:mt-12 flex flex-col items-center gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Free · No Tracker · No Login · No Ads · No Bullsh!t
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
