import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParticipantModeSelector } from "./ParticipantModeSelector";

describe("ParticipantModeSelector", () => {
  it("marks the active mode", () => {
    render(<ParticipantModeSelector mode="presenter" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /presenter/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("calls onChange with the selected mode", () => {
    const onChange = vi.fn();
    render(<ParticipantModeSelector mode="voter" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /spectator/i }));
    expect(onChange).toHaveBeenCalledWith("spectator");
  });
});
