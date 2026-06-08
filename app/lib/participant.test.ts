import { describe, it, expect } from "vitest";
import {
  INACTIVE_VISUAL_THRESHOLD_MS,
  OFFLINE_PARTICIPANT_TTL_MS,
  isParticipantVisuallyInactive,
} from "./participant";
import type { Participant } from "~/lib/types";

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    participantId: "p1",
    name: "Alice",
    role: "admin",
    mode: "voter",
    connected: true,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

describe("isParticipantVisuallyInactive", () => {
  const now = 1_000_000;

  it("returns false for connected participants", () => {
    expect(
      isParticipantVisuallyInactive(
        makeParticipant({ connected: true, lastSeenAt: now - 60_000 }),
        now
      )
    ).toBe(false);
  });

  it("returns false when disconnected for less than 30 seconds", () => {
    expect(
      isParticipantVisuallyInactive(
        makeParticipant({
          connected: false,
          lastSeenAt: now - INACTIVE_VISUAL_THRESHOLD_MS + 1,
        }),
        now
      )
    ).toBe(false);
  });

  it("returns true when disconnected for 30 seconds or more", () => {
    expect(
      isParticipantVisuallyInactive(
        makeParticipant({
          connected: false,
          lastSeenAt: now - INACTIVE_VISUAL_THRESHOLD_MS,
        }),
        now
      )
    ).toBe(true);
  });
});

describe("participant constants", () => {
  it("uses 30 second visual threshold", () => {
    expect(INACTIVE_VISUAL_THRESHOLD_MS).toBe(30_000);
  });

  it("uses 8 hour offline TTL", () => {
    expect(OFFLINE_PARTICIPANT_TTL_MS).toBe(8 * 60 * 60 * 1000);
  });
});
