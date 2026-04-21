import { describe, it, expect } from "vitest";
import {
  ROOM_NOT_FOUND_MESSAGE,
  getJoinErrorMessageFromSearch,
  roomNotFoundRedirectPath,
} from "./room-join";

describe("getJoinErrorMessageFromSearch", () => {
  it("returns room not found message for matching error code", () => {
    expect(getJoinErrorMessageFromSearch("?error=room_not_found")).toBe(
      ROOM_NOT_FOUND_MESSAGE
    );
  });

  it("returns null for missing or unknown error codes", () => {
    expect(getJoinErrorMessageFromSearch("")).toBeNull();
    expect(getJoinErrorMessageFromSearch("?error=unknown")).toBeNull();
  });
});

describe("roomNotFoundRedirectPath", () => {
  it("creates redirect path with room-not-found query", () => {
    expect(roomNotFoundRedirectPath()).toBe("/?error=room_not_found");
  });
});
