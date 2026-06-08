import type { Participant } from "~/lib/types";

export const INACTIVE_VISUAL_THRESHOLD_MS = 30_000;
export const OFFLINE_PARTICIPANT_TTL_MS = 8 * 60 * 60 * 1000;

export function isParticipantVisuallyInactive(
  participant: Participant,
  now: number = Date.now()
): boolean {
  return (
    !participant.connected &&
    now - participant.lastSeenAt >= INACTIVE_VISUAL_THRESHOLD_MS
  );
}
