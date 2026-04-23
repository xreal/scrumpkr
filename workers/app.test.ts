import { describe, it, expect } from "vitest";
import { env, exports } from "cloudflare:workers";

interface SocketMessage {
  type?: string;
  [key: string]: unknown;
}

async function nextSocketMessage(
  ws: WebSocket,
  timeoutMs = 1500
): Promise<SocketMessage> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("close", onClose);
    };

    const onMessage = (event: MessageEvent) => {
      cleanup();
      try {
        const parsed = JSON.parse(String(event.data)) as SocketMessage;
        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON from WebSocket"));
      }
    };

    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before message"));
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onClose);
  });
}

async function nextSocketMessageOfType(
  ws: WebSocket,
  type: string,
  attempts = 10
): Promise<SocketMessage> {
  for (let index = 0; index < attempts; index++) {
    const message = await nextSocketMessage(ws);
    if (message.type === type) {
      return message;
    }
  }

  throw new Error(`Timed out waiting for message type: ${type}`);
}

async function nextRoomStateMatching(
  ws: WebSocket,
  matcher: (room: {
    currentRound: { revealed: boolean; votes: Record<string, string | null> };
    history: Array<{ aggregation: string }>;
  }) => boolean,
  attempts = 20
) {
  for (let index = 0; index < attempts; index++) {
    const message = await nextSocketMessageOfType(ws, "room_state");
    const room = message.room as {
      currentRound: { revealed: boolean; votes: Record<string, string | null> };
      history: Array<{ aggregation: string }>;
    };
    if (matcher(room)) {
      return room;
    }
  }

  throw new Error("Timed out waiting for matching room_state");
}

async function drainSocketMessages(ws: WebSocket, maxMessages = 20): Promise<void> {
  for (let index = 0; index < maxMessages; index++) {
    try {
      await nextSocketMessage(ws, 60);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Timed out")) {
        return;
      }
      throw error;
    }
  }
}

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
    await expect(existingResponse.json()).resolves.toEqual({ exists: true, title: "Sprint 42" });

    const missingRequest = new Request("http://test/api/rooms/exists?roomId=foo");
    const missingResponse = await exports.default.fetch(missingRequest);
    expect(missingResponse.status).toBe(200);
    await expect(missingResponse.json()).resolves.toEqual({ exists: false, title: null });
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

  it("rejects vote changes after reveal", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Reveal Lock" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-1&token=test-token-1`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    expect(wsResponse.webSocket).toBeDefined();
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-1",
        name: "Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-1"] === null
    );

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-1",
        vote: "3",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-1"] === "3" && !room.currentRound.revealed
    );

    ws.send(
      JSON.stringify({
        action: "reveal",
        participantId: "tester-1",
      })
    );
    const revealRoom = await nextRoomStateMatching(
      ws,
      (room) =>
        room.currentRound.revealed &&
        room.currentRound.votes["tester-1"] === "3" &&
        room.history[0]?.aggregation === "1x3"
    );

    expect(revealRoom.currentRound.revealed).toBe(true);
    expect(revealRoom.currentRound.votes["tester-1"]).toBe("3");
    expect(revealRoom.history[0]?.aggregation).toBe("1x3");

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-1",
        vote: "5",
      })
    );
    const errorMessage = await nextSocketMessageOfType(ws, "error");
    expect(errorMessage.error).toBe("Round already revealed");

    ws.close();
  });

  it("does not duplicate history when reveal is retried", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Idempotent Reveal" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-2&token=test-token-2`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    expect(wsResponse.webSocket).toBeDefined();
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-2",
        name: "Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-2"] === null
    );

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-2",
        vote: "3",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-2"] === "3" && !room.currentRound.revealed
    );

    ws.send(
      JSON.stringify({
        action: "reveal",
        participantId: "tester-2",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) =>
        room.currentRound.revealed &&
        room.history.length === 1 &&
        room.history[0]?.aggregation === "1x3"
    );

    ws.send(
      JSON.stringify({
        action: "reveal",
        participantId: "tester-2",
      })
    );

    ws.send(
      JSON.stringify({
        action: "reset_round",
        participantId: "tester-2",
      })
    );

    const roomAfterReset = await nextRoomStateMatching(
      ws,
      (room) => !room.currentRound.revealed && room.currentRound.votes["tester-2"] === null
    );

    expect(roomAfterReset.history.length).toBe(1);
    expect(roomAfterReset.history[0]?.aggregation).toBe("1x3");

    ws.close();
  });

  it("clears reveal history entries", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Clear History" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-clear&token=test-token-clear`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-clear",
        name: "Clear Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-clear"] === null
    );

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-clear",
        vote: "5",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-clear"] === "5"
    );

    ws.send(
      JSON.stringify({
        action: "reveal",
        participantId: "tester-clear",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.revealed && room.history[0]?.aggregation === "1x5"
    );

    ws.send(
      JSON.stringify({
        action: "clear_history",
        participantId: "tester-clear",
      })
    );

    const roomAfterClear = await nextRoomStateMatching(
      ws,
      (room) => room.history.length === 0
    );

    expect(roomAfterClear.currentRound.revealed).toBe(true);
    expect(roomAfterClear.history).toEqual([]);

    ws.close();
  });

  it("does not broadcast to existing clients on connect-only events", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Connect Broadcast" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsAResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-a&token=test-token-a`,
        { headers: { Upgrade: "websocket" } }
      )
    );
    expect(wsAResponse.status).toBe(101);
    const wsA = wsAResponse.webSocket as WebSocket;
    wsA.accept();
    await nextSocketMessageOfType(wsA, "room_state");

    wsA.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-a",
        name: "A",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      wsA,
      (room) => room.currentRound.votes["tester-a"] === null
    );

    await drainSocketMessages(wsA);

    const unexpectedMessageForA = nextSocketMessage(wsA, 400);

    const wsBResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-b&token=test-token-b`,
        { headers: { Upgrade: "websocket" } }
      )
    );
    expect(wsBResponse.status).toBe(101);
    const wsB = wsBResponse.webSocket as WebSocket;
    wsB.accept();
    await nextSocketMessageOfType(wsB, "room_state");

    await expect(unexpectedMessageForA).rejects.toThrow(
      "Timed out waiting for WebSocket message"
    );

    wsA.close();
    wsB.close();
  });

  it("ignores duplicate reset when round is already clean", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Reset Idempotency" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-reset&token=test-token-reset`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-reset",
        name: "Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-reset"] === null
    );

    await drainSocketMessages(ws);

    ws.send(
      JSON.stringify({
        action: "reset_round",
        participantId: "tester-reset",
      })
    );

    await expect(nextSocketMessage(ws, 300)).rejects.toThrow(
      "Timed out waiting for WebSocket message"
    );

    ws.close();
  });

  it("limits sockets per participant to avoid fan-out abuse", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Socket Limits" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const ws1Response = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=abuser&token=shared-token`,
        { headers: { Upgrade: "websocket" } }
      )
    );
    const ws2Response = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=abuser&token=shared-token`,
        { headers: { Upgrade: "websocket" } }
      )
    );
    const ws3Response = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=abuser&token=shared-token`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(ws1Response.status).toBe(101);
    expect(ws2Response.status).toBe(101);
    expect(ws3Response.status).toBe(101);

    const ws1 = ws1Response.webSocket as WebSocket;
    const ws2 = ws2Response.webSocket as WebSocket;
    const ws3 = ws3Response.webSocket as WebSocket;

    ws1.accept();
    ws2.accept();
    ws3.accept();

    await nextSocketMessageOfType(ws1, "room_state");
    await nextSocketMessageOfType(ws2, "room_state");
    await nextSocketMessageOfType(ws3, "room_state");

    const ws4Response = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=abuser&token=shared-token`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(ws4Response.status).toBe(429);

    ws1.close();
    ws2.close();
    ws3.close();
  });

  it("ignores duplicate join retries when participant data is unchanged", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Join Idempotency" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-join&token=test-token-join`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-join",
        name: "Join Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-join"] === null
    );

    await drainSocketMessages(ws);

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-join",
        name: "Join Tester",
        mode: "voter",
      })
    );

    await expect(nextSocketMessage(ws, 300)).rejects.toThrow(
      "Timed out waiting for WebSocket message"
    );

    ws.close();
  });

  it("limits total active sockets per room", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Room Socket Limits" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const sockets: WebSocket[] = [];

    for (let index = 0; index < 50; index++) {
      const wsResponse = await exports.default.fetch(
        new Request(
          `http://test/ws/${roomId}?participantId=room-socket-${index}&token=token-${index}`,
          { headers: { Upgrade: "websocket" } }
        )
      );

      expect(wsResponse.status).toBe(101);
      const ws = wsResponse.webSocket as WebSocket;
      ws.accept();
      await nextSocketMessageOfType(ws, "room_state");
      sockets.push(ws);
    }

    const overflowResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=room-socket-overflow&token=token-overflow`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(overflowResponse.status).toBe(429);

    for (const socket of sockets) {
      socket.close();
    }
  });

  it("ignores duplicate vote retries with same value", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Vote Idempotency" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-vote&token=test-token-vote`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-vote",
        name: "Vote Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-vote"] === null
    );

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-vote",
        vote: "5",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-vote"] === "5"
    );

    await drainSocketMessages(ws);

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-vote",
        vote: "5",
      })
    );

    await expect(nextSocketMessage(ws, 300)).rejects.toThrow(
      "Timed out waiting for WebSocket message"
    );

    ws.close();
  });

  it("excludes spectator votes from reveal aggregation", async () => {
    const createRequest = new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Spectator Aggregation" }),
    });
    const createResponse = await exports.default.fetch(createRequest);
    const { roomId } = (await createResponse.json()) as { roomId: string };

    const wsResponse = await exports.default.fetch(
      new Request(
        `http://test/ws/${roomId}?participantId=tester-spec&token=test-token-spec`,
        { headers: { Upgrade: "websocket" } }
      )
    );

    expect(wsResponse.status).toBe(101);
    const ws = wsResponse.webSocket as WebSocket;
    ws.accept();

    await nextSocketMessageOfType(ws, "room_state");

    ws.send(
      JSON.stringify({
        action: "join",
        participantId: "tester-spec",
        name: "Spec Tester",
        mode: "voter",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-spec"] === null
    );

    ws.send(
      JSON.stringify({
        action: "vote",
        participantId: "tester-spec",
        vote: "5",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-spec"] === "5"
    );

    ws.send(
      JSON.stringify({
        action: "set_mode",
        participantId: "tester-spec",
        mode: "spectator",
      })
    );
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-spec"] === null
    );

    ws.send(
      JSON.stringify({
        action: "reveal",
        participantId: "tester-spec",
      })
    );

    const revealedRoom = await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.revealed && room.history.length > 0
    );

    expect(revealedRoom.history[0]?.aggregation).toBe("no votes");

    ws.close();
  });
});
