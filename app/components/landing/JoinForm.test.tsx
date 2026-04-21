import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JoinForm } from "./JoinForm";

vi.mock("~/lib/storage", () => ({
  getDisplayName: vi.fn(() => null),
}));

describe("JoinForm", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
  };

  it("shows 'Create Room' when no room code is entered", () => {
    render(<JoinForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: /create room/i })).toBeInTheDocument();
  });

  it("shows 'Join Room' when a room code is entered", () => {
    render(<JoinForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/leave empty/i), {
      target: { value: "ABC123" },
    });
    expect(screen.getByRole("button", { name: /join room/i })).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed name and undefined room code when creating", () => {
    const onSubmit = vi.fn();
    render(<JoinForm {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: "  Alice  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(onSubmit).toHaveBeenCalledWith("Alice", undefined);
  });

  it("calls onSubmit with trimmed name and room code when joining", () => {
    const onSubmit = vi.fn();
    render(<JoinForm {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByPlaceholderText(/leave empty/i), {
      target: { value: "  XYZ  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /join room/i }));
    expect(onSubmit).toHaveBeenCalledWith("Bob", "XYZ");
  });

  it("does not submit when name is blank", () => {
    const onSubmit = vi.fn();
    render(<JoinForm {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows rejoin button when lastRoom is provided with onRejoinLast", () => {
    render(
      <JoinForm {...defaultProps} lastRoom="ROOM1" onRejoinLast={vi.fn()} />
    );
    expect(screen.getByText(/rejoin last room/i)).toBeInTheDocument();
  });

  it("hides rejoin button when no lastRoom", () => {
    render(<JoinForm {...defaultProps} />);
    expect(screen.queryByText(/rejoin last room/i)).not.toBeInTheDocument();
  });

  it("calls onRejoinLast with current name when rejoin is clicked", () => {
    const onRejoinLast = vi.fn();
    render(
      <JoinForm
        {...defaultProps}
        lastRoom="ROOM1"
        onRejoinLast={onRejoinLast}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: "Eve" },
    });
    fireEvent.click(screen.getByText(/rejoin last room/i));
    expect(onRejoinLast).toHaveBeenCalledWith("Eve");
  });

  it("shows error message and clears it on input changes", () => {
    const onClearError = vi.fn();
    render(
      <JoinForm
        {...defaultProps}
        errorMessage="Room not found."
        onClearError={onClearError}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Room not found.");

    fireEvent.change(screen.getByPlaceholderText(/jane doe/i), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText(/leave empty/i), {
      target: { value: "ROOM123" },
    });

    expect(onClearError).toHaveBeenCalledTimes(2);
  });
});
