import { describe, it, expect } from "vitest";
import {
  getPresenterVoteHint,
  isPresenterVotePrefix,
  parsePresenterVoteInput,
} from "./presenter-vote";

describe("parsePresenterVoteInput", () => {
  it("parses complete deck values", () => {
    expect(parsePresenterVoteInput("13")).toBe("13");
    expect(parsePresenterVoteInput("21")).toBe("21");
    expect(parsePresenterVoteInput("1")).toBe("1");
    expect(parsePresenterVoteInput("2")).toBe("2");
    expect(parsePresenterVoteInput("0.5")).toBe("0.5");
    expect(parsePresenterVoteInput("?")).toBe("?");
  });

  it("rejects partial or invalid input", () => {
    expect(parsePresenterVoteInput("")).toBeNull();
    expect(parsePresenterVoteInput("12")).toBeNull();
    expect(parsePresenterVoteInput("99")).toBeNull();
    expect(parsePresenterVoteInput("0.")).toBeNull();
  });
});

describe("isPresenterVotePrefix", () => {
  it("accepts valid prefixes including ambiguous ones", () => {
    expect(isPresenterVotePrefix("")).toBe(true);
    expect(isPresenterVotePrefix("1")).toBe(true);
    expect(isPresenterVotePrefix("13")).toBe(true);
    expect(isPresenterVotePrefix("2")).toBe(true);
    expect(isPresenterVotePrefix("21")).toBe(true);
    expect(isPresenterVotePrefix("0")).toBe(true);
    expect(isPresenterVotePrefix("0.")).toBe(true);
  });

  it("rejects impossible prefixes", () => {
    expect(isPresenterVotePrefix("4")).toBe(false);
    expect(isPresenterVotePrefix("12")).toBe(false);
    expect(isPresenterVotePrefix("22")).toBe(false);
  });
});

describe("getPresenterVoteHint", () => {
  it("never reveals typed digits in hints", () => {
    expect(getPresenterVoteHint("1")).toBe("Press Enter to vote");
    expect(getPresenterVoteHint("2")).toBe("Press Enter to vote");
    expect(getPresenterVoteHint("0")).toBe("Press Enter to vote");
    expect(getPresenterVoteHint("13")).toBe("Press Enter to vote");
    expect(getPresenterVoteHint("21")).toBe("Press Enter to vote");
  });

  it("guides incomplete prefixes without exposing length", () => {
    expect(getPresenterVoteHint("0.")).toBe("Keep typing…");
  });
});
