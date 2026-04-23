import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParticipantList } from "./ParticipantList";
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

describe("ParticipantList", () => {
  const defaultProps = {
    participants: [makeParticipant()],
    revealed: false,
    votes: {} as Record<string, string | null>,
    myId: null,
    onOpenRemove: vi.fn(),
  };

  it("shows ✓ for a voter who has voted before reveal", () => {
    render(<ParticipantList {...defaultProps} votes={{ p1: "5" }} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("shows the actual vote value after reveal", () => {
    render(
      <ParticipantList {...defaultProps} revealed={true} votes={{ p1: "8" }} />
    );
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("shows — for a participant who has not voted after reveal", () => {
    render(
      <ParticipantList {...defaultProps} revealed={true} votes={{ p1: null }} />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows — for a hidden vote after reveal", () => {
    render(
      <ParticipantList
        {...defaultProps}
        revealed={true}
        votes={{ p1: "hidden" }}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows (You) suffix for the current participant", () => {
    render(<ParticipantList {...defaultProps} myId="p1" />);
    expect(screen.getByText(/Alice.*\(You\)/)).toBeInTheDocument();
  });

  it("does not show (You) for other participants", () => {
    const participants = [
      makeParticipant({ participantId: "p1", name: "Alice" }),
      makeParticipant({ participantId: "p2", name: "Bob" }),
    ];
    render(
      <ParticipantList {...defaultProps} participants={participants} myId="p1" />
    );
    expect(screen.getByText(/Bob/)).not.toHaveTextContent("(You)");
  });

  it("shows Spectator badge for spectators", () => {
    render(
      <ParticipantList
        {...defaultProps}
        participants={[makeParticipant({ mode: "spectator" })]}
      />
    );
    expect(screen.getByText("Spectator")).toBeInTheDocument();
  });

  it("does not show Spectator badge for voters", () => {
    render(
      <ParticipantList
        {...defaultProps}
        participants={[makeParticipant({ mode: "voter" })]}
      />
    );
    expect(screen.queryByText("Spectator")).not.toBeInTheDocument();
  });

  it("calls onOpenRemove when remove button is clicked", () => {
    const onOpenRemove = vi.fn();
    render(
      <ParticipantList {...defaultProps} onOpenRemove={onOpenRemove} />
    );
    fireEvent.click(screen.getByTitle("Remove participants"));
    expect(onOpenRemove).toHaveBeenCalledOnce();
  });

  it("allows poking a non-voter when onPoke is provided", () => {
    const onPoke = vi.fn();
    const participants = [
      makeParticipant({ participantId: "p1", name: "Alice" }),
      makeParticipant({ participantId: "p2", name: "Bob" }),
    ];
    render(
      <ParticipantList
        {...defaultProps}
        participants={participants}
        myId="p1"
        onPoke={onPoke}
      />
    );
    const pokeButton = screen.getByTitle("Poke Bob to vote");
    expect(pokeButton).toBeInTheDocument();
    fireEvent.click(pokeButton);
    expect(onPoke).toHaveBeenCalledWith("p2");
  });

  it("does not allow poking self", () => {
    const onPoke = vi.fn();
    render(
      <ParticipantList {...defaultProps} myId="p1" onPoke={onPoke} />
    );
    expect(screen.queryByTitle(/Poke/)).not.toBeInTheDocument();
  });

  it("does not allow poking a voter who has already voted", () => {
    const onPoke = vi.fn();
    const participants = [
      makeParticipant({ participantId: "p1", name: "Alice" }),
      makeParticipant({ participantId: "p2", name: "Bob" }),
    ];
    render(
      <ParticipantList
        {...defaultProps}
        participants={participants}
        myId="p1"
        votes={{ p2: "5" }}
        onPoke={onPoke}
      />
    );
    expect(screen.queryByTitle("Poke Bob to vote")).not.toBeInTheDocument();
  });

  it("does not allow poking after reveal", () => {
    const onPoke = vi.fn();
    const participants = [
      makeParticipant({ participantId: "p1", name: "Alice" }),
      makeParticipant({ participantId: "p2", name: "Bob" }),
    ];
    render(
      <ParticipantList
        {...defaultProps}
        participants={participants}
        myId="p1"
        revealed={true}
        onPoke={onPoke}
      />
    );
    expect(screen.queryByTitle(/Poke/)).not.toBeInTheDocument();
  });
});
