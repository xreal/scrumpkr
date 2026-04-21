import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpectatorToggle } from "./SpectatorToggle";

describe("SpectatorToggle", () => {
  it("shows unchecked checkbox when mode is voter", () => {
    render(<SpectatorToggle mode="voter" onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows checked checkbox when mode is spectator", () => {
    render(<SpectatorToggle mode="spectator" onToggle={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onToggle with 'spectator' when toggled from voter", () => {
    const onToggle = vi.fn();
    render(<SpectatorToggle mode="voter" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("spectator");
  });

  it("calls onToggle with 'voter' when toggled from spectator", () => {
    const onToggle = vi.fn();
    render(<SpectatorToggle mode="spectator" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("voter");
  });
});
