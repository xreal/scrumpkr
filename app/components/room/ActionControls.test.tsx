import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionControls } from "./ActionControls";

describe("ActionControls", () => {
  it("shows Reveal button when not revealed", () => {
    render(
      <ActionControls
        revealed={false}
        onReveal={vi.fn()}
        onReset={vi.fn()}
        hasVotes={true}
      />
    );
    expect(screen.getByRole("button", { name: /reveal/i })).toBeInTheDocument();
  });

  it("shows New Round button when revealed", () => {
    render(
      <ActionControls
        revealed={true}
        onReveal={vi.fn()}
        onReset={vi.fn()}
        hasVotes={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /new round/i })
    ).toBeInTheDocument();
  });

  it("disables Reveal button when there are no votes", () => {
    render(
      <ActionControls
        revealed={false}
        onReveal={vi.fn()}
        onReset={vi.fn()}
        hasVotes={false}
      />
    );
    expect(screen.getByRole("button", { name: /reveal/i })).toBeDisabled();
  });

  it("enables Reveal button when there are votes", () => {
    render(
      <ActionControls
        revealed={false}
        onReveal={vi.fn()}
        onReset={vi.fn()}
        hasVotes={true}
      />
    );
    expect(screen.getByRole("button", { name: /reveal/i })).toBeEnabled();
  });

  it("calls onReveal when Reveal is clicked", () => {
    const onReveal = vi.fn();
    render(
      <ActionControls
        revealed={false}
        onReveal={onReveal}
        onReset={vi.fn()}
        hasVotes={true}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /reveal/i }));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("calls onReset when New Round is clicked", () => {
    const onReset = vi.fn();
    render(
      <ActionControls
        revealed={true}
        onReveal={vi.fn()}
        onReset={onReset}
        hasVotes={true}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /new round/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
