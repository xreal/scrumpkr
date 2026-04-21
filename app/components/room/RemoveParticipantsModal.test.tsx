import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RemoveParticipantsModal } from "./RemoveParticipantsModal";
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

describe("RemoveParticipantsModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    participants: [
      makeParticipant({ participantId: "p1", name: "Alice" }),
      makeParticipant({ participantId: "p2", name: "Bob" }),
      makeParticipant({ participantId: "p3", name: "Carol" }),
    ],
    myId: "p1",
    onRemove: vi.fn(),
  };

  it("renders nothing when isOpen is false", () => {
    render(<RemoveParticipantsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/remove participants/i)).not.toBeInTheDocument();
  });

  it("excludes current user from removable list", () => {
    render(<RemoveParticipantsModal {...defaultProps} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("shows empty message when only self is in room", () => {
    render(
      <RemoveParticipantsModal
        {...defaultProps}
        participants={[makeParticipant({ participantId: "p1", name: "Alice" })]}
        myId="p1"
      />
    );
    expect(
      screen.getByText(/no participants available/i)
    ).toBeInTheDocument();
  });

  it("shows (Inactive) label for disconnected participants", () => {
    render(
      <RemoveParticipantsModal
        {...defaultProps}
        participants={[
          makeParticipant({
            participantId: "p2",
            name: "Bob",
            connected: false,
          }),
        ]}
        myId="p1"
      />
    );
    expect(screen.getByText(/bob.*inactive/i)).toBeInTheDocument();
  });

  it("calls onRemove with correct participantId and onClose when Remove is clicked", () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    render(
      <RemoveParticipantsModal
        {...defaultProps}
        onRemove={onRemove}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("p2");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<RemoveParticipantsModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
