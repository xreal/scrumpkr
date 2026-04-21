import { useEffect, useState } from "react";
import { roomNotFoundRedirectPath } from "~/lib/room-join";

interface UseRoomExistenceResult {
  roomExists: boolean | null;
}

export function useRoomExistence(
  roomId: string | undefined,
  navigate: (to: string, options?: { replace?: boolean }) => void
): UseRoomExistenceResult {
  const [roomExists, setRoomExists] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const checkRoomExists = async () => {
      const trimmedRoomId = roomId?.trim();
      if (!trimmedRoomId) {
        navigate(roomNotFoundRedirectPath(), { replace: true });
        return;
      }

      setRoomExists(null);

      try {
        const response = await fetch(
          `/api/rooms/exists?roomId=${encodeURIComponent(trimmedRoomId)}`
        );

        if (!response.ok) {
          throw new Error("room lookup failed");
        }

        const payload = (await response.json()) as { exists?: boolean };
        if (!active) {
          return;
        }

        if (!payload.exists) {
          navigate(roomNotFoundRedirectPath(), { replace: true });
          return;
        }

        setRoomExists(true);
      } catch {
        if (!active) {
          return;
        }

        navigate(roomNotFoundRedirectPath(), { replace: true });
      }
    };

    void checkRoomExists();

    return () => {
      active = false;
    };
  }, [roomId, navigate]);

  return { roomExists };
}
