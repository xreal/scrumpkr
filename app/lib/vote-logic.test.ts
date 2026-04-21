import { describe, it, expect } from "vitest";
import {
  DECK,
  VALID_VOTES,
  isValidVote,
  sanitizeName,
  sanitizeTitle,
  aggregateReveal,
  computeAverage,
  isNumericCard,
} from "./vote-logic";

describe("DECK", () => {
  it("contains the standard planning poker cards", () => {
    expect(DECK).toEqual([
      "0",
      "1",
      "2",
      "3",
      "5",
      "8",
      "13",
      "21",
      "coffee",
      "?",
    ]);
  });

  it("has every value in VALID_VOTES", () => {
    for (const card of DECK) {
      expect(VALID_VOTES.has(card)).toBe(true);
    }
  });
});

describe("sanitizeName", () => {
  it("trims whitespace", () => {
    expect(sanitizeName("  Alice  ")).toBe("Alice");
  });

  it("returns undefined for empty string", () => {
    expect(sanitizeName("")).toBeUndefined();
    expect(sanitizeName("   ")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(sanitizeName(undefined)).toBeUndefined();
  });

  it("truncates to 40 characters", () => {
    const longName = "A".repeat(50);
    expect(sanitizeName(longName)).toBe("A".repeat(40));
  });
});

describe("sanitizeTitle", () => {
  it("trims whitespace", () => {
    expect(sanitizeTitle("  Sprint Planning  ")).toBe("Sprint Planning");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeTitle("")).toBe("");
    expect(sanitizeTitle(undefined)).toBe("");
  });

  it("truncates to 120 characters", () => {
    const longTitle = "T".repeat(150);
    expect(sanitizeTitle(longTitle)).toBe("T".repeat(120));
  });
});

describe("isValidVote", () => {
  it("accepts null", () => {
    expect(isValidVote(null)).toBe(true);
  });

  it("accepts undefined", () => {
    expect(isValidVote(undefined)).toBe(true);
  });

  it("accepts every card in the deck", () => {
    for (const card of DECK) {
      expect(isValidVote(card)).toBe(true);
    }
  });

  it("rejects invalid votes", () => {
    expect(isValidVote("99")).toBe(false);
    expect(isValidVote("foo")).toBe(false);
    expect(isValidVote("")).toBe(false);
  });
});

describe("aggregateReveal", () => {
  it("returns 'no votes' for empty or null-only votes", () => {
    expect(aggregateReveal([])).toBe("no votes");
    expect(aggregateReveal([null, null])).toBe("no votes");
  });

  it("aggregates single vote", () => {
    expect(aggregateReveal(["5"])).toBe("1x5");
  });

  it("aggregates multiple votes sorted by frequency", () => {
    expect(aggregateReveal(["3", "3", "5", "5", "5", "?"])).toBe(
      "3x5, 2x3, 1x?"
    );
  });

  it("ignores null votes", () => {
    expect(aggregateReveal(["8", null, "8", null])).toBe("2x8");
  });
});

describe("computeAverage", () => {
  it("returns em-dash for no numeric votes", () => {
    expect(computeAverage([null, "?", "coffee"])).toBe("—");
  });

  it("computes average of numeric votes", () => {
    expect(computeAverage(["3", "5", "8"])).toBe("5.3");
  });

  it("ignores non-numeric cards", () => {
    expect(computeAverage(["5", "?", "coffee", null])).toBe("5.0");
  });
});

describe("isNumericCard", () => {
  it("returns true for numeric cards", () => {
    expect(isNumericCard("5")).toBe(true);
    expect(isNumericCard("21")).toBe(true);
  });

  it("returns false for special cards", () => {
    expect(isNumericCard("?")).toBe(false);
    expect(isNumericCard("coffee")).toBe(false);
  });
});
