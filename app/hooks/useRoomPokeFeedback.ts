import { useCallback, useEffect, useRef } from "react";

function playPokeSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore audio errors
  }
}

function getBaseTitle(roomTitle: string | undefined, roomId: string | undefined): string {
  if (roomTitle) {
    return `scrumpkr > ${roomTitle}`;
  }
  if (roomId) {
    return `scrumpkr > ${roomId}`;
  }
  return "scrumpkr.";
}

interface UseRoomPokeFeedbackParams {
  roomId?: string;
}

interface UseRoomPokeFeedbackResult {
  handlePoke: (fromName: string) => void;
  syncDocumentTitle: (roomTitle?: string) => void;
}

export function useRoomPokeFeedback({
  roomId,
}: UseRoomPokeFeedbackParams): UseRoomPokeFeedbackResult {
  const pokeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomTitleRef = useRef<string | undefined>(undefined);

  const handlePoke = useCallback(
    (fromName: string) => {
      playPokeSound();
      if (pokeIntervalRef.current) {
        clearInterval(pokeIntervalRef.current);
      }
      const baseTitle = getBaseTitle(roomTitleRef.current, roomId);
      let count = 0;
      pokeIntervalRef.current = setInterval(() => {
        document.title = count % 2 === 0 ? `📢 ${fromName} poked you!` : baseTitle;
        count += 1;
        if (count >= 6) {
          if (pokeIntervalRef.current) {
            clearInterval(pokeIntervalRef.current);
            pokeIntervalRef.current = null;
          }
          document.title = baseTitle;
        }
      }, 500);
    },
    [roomId]
  );

  useEffect(() => {
    return () => {
      if (pokeIntervalRef.current) {
        clearInterval(pokeIntervalRef.current);
      }
    };
  }, []);

  const syncDocumentTitle = useCallback(
    (roomTitle?: string) => {
      roomTitleRef.current = roomTitle;
      if (pokeIntervalRef.current) {
        return;
      }
      document.title = getBaseTitle(roomTitle, roomId);
    },
    [roomId]
  );

  return { handlePoke, syncDocumentTitle };
}
