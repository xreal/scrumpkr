import { describe, it, expect } from "vitest";
import { env, exports } from "cloudflare:workers";

describe("Worker API", () => {
  it("creates a room and returns roomId", async () => {
    const request = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sprint 42" }),
    });
    const response = await exports.default.fetch(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as { roomId: string };
    expect(json.roomId).toBeDefined();
    expect(typeof json.roomId).toBe("string");
    expect(json.roomId.length).toBeGreaterThan(0);
    expect(response.headers.get("X-Room-Id")).toBe(json.roomId);
  });

  it("returns exists=true only for already created rooms", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sprint 42" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const created = (await createResponse.json()) as { roomId: string };

    const existingRequest = new Request(
      `http://test/api/rooms/exists?roomId=${created.roomId}`
    );
    const existingResponse = await exports.default.fetch(existingRequest);
    expect(existingResponse.status).toBe(200);
    await expect(existingResponse.json()).resolves.toEqual({ exists: true });

    const missingRequest = new Request("http://test/api/rooms/exists?roomId=foo");
    const missingResponse = await exports.default.fetch(missingRequest);
    expect(missingResponse.status).toBe(200);
    await expect(missingResponse.json()).resolves.toEqual({ exists: false });
  });
});

describe("PokerRoom Durable Object", () => {
  it("initializes room on first API call", async () => {
    const roomId = "test-room-1";
    const id = env.POKER_ROOM.idFromName(roomId);
    const stub = env.POKER_ROOM.get(id);

    const request = new Request(`http://test/api/rooms?roomId=${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Direct Init" }),
    });

    const response = await stub.fetch(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as { roomId: string };
    expect(json.roomId).toBe(roomId);
  });

  it("returns 404 for unknown paths", async () => {
    const roomId = "test-room-2";
    const id = env.POKER_ROOM.idFromName(roomId);
    const stub = env.POKER_ROOM.get(id);

    const request = new Request("http://test/unknown");
    const response = await stub.fetch(request);
    expect(response.status).toBe(404);
  });
});
