import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresenterVoting } from "./PresenterVoting";

describe("PresenterVoting", () => {
  it("shows only a centered checkmark in the voted overlay", () => {
    render(
      <PresenterVoting
        revealed={false}
        hasVoted
        myVote="8"
        onVote={vi.fn()}
        onClearVote={vi.fn()}
      />
    );
    expect(screen.getByText("You voted")).toBeInTheDocument();
    expect(screen.getByText("Use Esc to change your vote before reveal.")).toBeInTheDocument();
    expect(screen.getByTestId("presenter-overlay-checkmark")).toBeInTheDocument();
    expect(screen.queryByTestId("presenter-digit-0")).not.toBeInTheDocument();
  });

  it("always shows two dummy digits and masks typing with two bullets", () => {
    const onVote = vi.fn();
    const { rerender } = render(
      <PresenterVoting
        revealed={false}
        hasVoted={false}
        myVote={null}
        onVote={onVote}
        onClearVote={vi.fn()}
      />
    );

    expect(screen.getByTestId("presenter-digit-0")).toHaveTextContent("0");
    expect(screen.getByTestId("presenter-digit-1")).toHaveTextContent("0");

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByTestId("presenter-digit-0")).toHaveTextContent("•");
    expect(screen.getByTestId("presenter-digit-1")).toHaveTextContent("•");
    expect(screen.queryByTestId("presenter-vote-checkmark")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onVote).toHaveBeenCalledWith("13");

    rerender(
      <PresenterVoting
        revealed={false}
        hasVoted
        myVote="13"
        onVote={onVote}
        onClearVote={vi.fn()}
      />
    );
    expect(screen.getAllByTestId("presenter-vote-checkmark").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Vote recorded")).toBeInTheDocument();
  });

  it("clears a recorded vote on Esc and returns to idle input", () => {
    const onClearVote = vi.fn();
    const { rerender } = render(
      <PresenterVoting
        revealed={false}
        hasVoted
        myVote="8"
        onVote={vi.fn()}
        onClearVote={onClearVote}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClearVote).toHaveBeenCalledTimes(1);

    rerender(
      <PresenterVoting
        revealed={false}
        hasVoted={false}
        myVote={null}
        onVote={vi.fn()}
        onClearVote={onClearVote}
      />
    );
    expect(screen.queryByText("You voted")).not.toBeInTheDocument();
    expect(screen.getByTestId("presenter-digit-0")).toHaveTextContent("0");
  });

  it("reveals the selected card after reveal", () => {
    render(
      <PresenterVoting
        revealed
        hasVoted
        myVote="5"
        onVote={vi.fn()}
        onClearVote={vi.fn()}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("You voted")).not.toBeInTheDocument();
  });
});
