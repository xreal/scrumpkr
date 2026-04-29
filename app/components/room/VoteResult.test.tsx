import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoteResult } from "./VoteResult";
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

describe("VoteResult", () => {
  it("shows — when no numeric votes exist", () => {
    const participants = [
      makeParticipant({ participantId: "p1", mode: "voter" }),
    ];
    render(<VoteResult participants={participants} votes={{ p1: "?" }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows — when all votes are null", () => {
    const participants = [
      makeParticipant({ participantId: "p1", mode: "voter" }),
    ];
    render(<VoteResult participants={participants} votes={{ p1: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("computes average from numeric voter votes", () => {
    const participants = [
      makeParticipant({ participantId: "p1", mode: "voter" }),
      makeParticipant({ participantId: "p2", mode: "voter" }),
    ];
    render(
      <VoteResult participants={participants} votes={{ p1: "5", p2: "8" }} />
    );
    expect(screen.getByText("6.5")).toBeInTheDocument();
  });

  it("excludes spectator votes from average", () => {
    const participants = [
      makeParticipant({ participantId: "p1", mode: "voter" }),
      makeParticipant({ participantId: "p2", mode: "spectator" }),
    ];
    render(
      <VoteResult participants={participants} votes={{ p1: "5", p2: "13" }} />
    );
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });

  it("excludes non-numeric votes (?) from average", () => {
    const participants = [
      makeParticipant({ participantId: "p1", mode: "voter" }),
      makeParticipant({ participantId: "p2", mode: "voter" }),
    ];
    render(
      <VoteResult
        participants={participants}
        votes={{ p1: "5", p2: "?" }}
      />
    );
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });
});
