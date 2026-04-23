import { useEffect, useState } from "react";
import { roomNotFoundRedirectPath } from "~/lib/room-join";

interface UseRoomExistenceResult {
  roomExists: boolean | null;
}

const existenceCache = new Map<string, Promise<{ exists: boolean; title: string | null }>>();

function checkRoomExists(roomId: string): Promise<{ exists: boolean; title: string | null }> {
  const cached = existenceCache.get(roomId);
  if (cached) return cached;

  const promise = fetch(`/api/rooms/exists?roomId=${encodeURIComponent(roomId)}`)
    .then(async (response) => {
      if (!response.ok) {
        existenceCache.delete(roomId);
        throw new Error("room lookup failed");
      }
      const payload = (await response.json()) as { exists?: boolean; title?: string | null };
      return { exists: !!payload.exists, title: payload.title ?? null };
    })
    .catch((error) => {
      existenceCache.delete(roomId);
      throw error;
    });

  existenceCache.set(roomId, promise);
  return promise;
}

export function useRoomExistence(
  roomId: string | undefined,
  navigate: (to: string, options?: { replace?: boolean }) => void
): UseRoomExistenceResult {
  const [roomExists, setRoomExists] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) {
      navigate(roomNotFoundRedirectPath(), { replace: true });
      return;
    }

    setRoomExists(null);

    checkRoomExists(trimmedRoomId)
      .then((result) => {
        if (!active) return;

        if (!result.exists) {
          navigate(roomNotFoundRedirectPath(), { replace: true });
          return;
        }

        setRoomExists(true);
      })
      .catch(() => {
        if (!active) return;
        navigate(roomNotFoundRedirectPath(), { replace: true });
      });

    return () => {
      active = false;
    };
  }, [roomId, navigate]);

  return { roomExists };
}