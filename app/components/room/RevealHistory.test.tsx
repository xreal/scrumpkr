import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevealHistory, timeAgo } from "./RevealHistory";
import type { RevealEntry } from "~/lib/types";

vi.useFakeTimers();
vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

describe("timeAgo", () => {
  it("returns 'just now' for less than 1 minute", () => {
    expect(timeAgo(Date.now() - 30000)).toBe("just now");
  });

  it("returns minutes for less than an hour", () => {
    expect(timeAgo(Date.now() - 5 * 60000)).toBe("5m ago");
  });

  it("returns hours for less than a day", () => {
    expect(timeAgo(Date.now() - 3 * 3600000)).toBe("3h ago");
  });

  it("returns days for longer periods", () => {
    expect(timeAgo(Date.now() - 2 * 86400000)).toBe("2d ago");
  });
});

describe("RevealHistory", () => {
  it("renders nothing when history is empty", () => {
    const { container } = render(<RevealHistory history={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders history entries with aggregation text", () => {
    const history: RevealEntry[] = [
      { timestamp: Date.now() - 60000, aggregation: "2x5, 1x8" },
      { timestamp: Date.now() - 3600000, aggregation: "3x3" },
    ];
    render(<RevealHistory history={history} />);
    expect(screen.getByText("2x5, 1x8")).toBeInTheDocument();
    expect(screen.getByText("3x3")).toBeInTheDocument();
  });

  it("displays relative timestamps", () => {
    const history: RevealEntry[] = [
      { timestamp: Date.now() - 60000, aggregation: "1x5" },
    ];
    render(<RevealHistory history={history} />);
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });
});
