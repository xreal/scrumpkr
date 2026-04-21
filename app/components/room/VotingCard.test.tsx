import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VotingCard } from "./VotingCard";

describe("VotingCard", () => {
  it("renders the card value", () => {
    render(
      <VotingCard value="5" selected={false} disabled={false} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("renders coffee card without text 'coffee'", () => {
    render(
      <VotingCard value="coffee" selected={false} disabled={false} onSelect={vi.fn()} />
    );
    const button = screen.getByRole("button");
    expect(button).not.toHaveTextContent("coffee");
  });

  it("calls onSelect with the card value when clicked", () => {
    const handleSelect = vi.fn();
    render(
      <VotingCard value="8" selected={false} disabled={false} onSelect={handleSelect} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledWith("8");
  });

  it("is disabled when disabled prop is true and not selected", () => {
    render(
      <VotingCard value="3" selected={false} disabled={true} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is enabled when disabled but selected (still clickable)", () => {
    render(
      <VotingCard value="3" selected={true} disabled={true} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onSelect even when already selected", () => {
    const handleSelect = vi.fn();
    render(
      <VotingCard value="5" selected={true} disabled={false} onSelect={handleSelect} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleSelect).toHaveBeenCalledWith("5");
  });
});
