import { describe, it, expect } from "vitest";
import { env, exports } from "cloudflare:workers";

interface SocketMessage {
  type?: string;
  [key: string]: unknown;
}

interface TestRoomState {
  currentRound: { revealed: boolean; votes: Record<string, string | null> };
  history: Array<{ aggregation: string }>;
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
  matcher: (room: TestRoomState) => boolean,
  attempts = 20
) {
  for (let index = 0; index < attempts; index++) {
    const message = await nextSocketMessageOfType(ws, "room_state");
    const room = message.room as TestRoomState;
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

async function createRoom(title: string): Promise<string> {
  const createResponse = await exports.default.fetch(
    new Request("http://test/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
  );

  expect(createResponse.status).toBe(200);
  const { roomId } = (await createResponse.json()) as { roomId: string };
  return roomId;
}

function websocketRequest(roomId: string, participantId: string, token: string): Request {
  return new Request(
    `http://test/ws/${roomId}?participantId=${participantId}&token=${token}`,
    { headers: { Upgrade: "websocket" } }
  );
}

async function connectParticipantSocket(
  roomId: string,
  participantId: string,
  token: string
): Promise<WebSocket> {
  const wsResponse = await exports.default.fetch(
    websocketRequest(roomId, participantId, token)
  );

  expect(wsResponse.status).toBe(101);
  expect(wsResponse.webSocket).toBeDefined();

  const ws = wsResponse.webSocket as WebSocket;
  ws.accept();
  await nextSocketMessageOfType(ws, "room_state");
  return ws;
}

function sendAction(ws: WebSocket, action: Record<string, unknown>): void {
  ws.send(JSON.stringify(action));
}

async function joinAsVoter(ws: WebSocket, participantId: string, name: string): Promise<void> {
  sendAction(ws, {
    action: "join",
    participantId,
    name,
    mode: "voter",
  });

  await nextRoomStateMatching(
    ws,
    (room) => room.currentRound.votes[participantId] === null
  );
}

async function setupVoterSession(
  title: string,
  participantId: string,
  token: string,
  name: string
): Promise<{ roomId: string; ws: WebSocket }> {
  const roomId = await createRoom(title);
  const ws = await connectParticipantSocket(roomId, participantId, token);
  await joinAsVoter(ws, participantId, name);
  return { roomId, ws };
}

async function expectNoSocketMessage(ws: WebSocket, timeoutMs = 300): Promise<void> {
  await expect(nextSocketMessage(ws, timeoutMs)).rejects.toThrow(
    "Timed out waiting for WebSocket message"
  );
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
    const roomId = await createRoom("Sprint 42");

    const existingRequest = new Request(
      `http://test/api/rooms/exists?roomId=${roomId}`
    );
    const existingResponse = await exports.default.fetch(existingRequest);
    expect(existingResponse.status).toBe(200);
    await expect(existingResponse.json()).resolves.toEqual({ exists: true, title: "Sprint 42" });

    const missingRequest = new Request("http://test/api/rooms/exists?roomId=foo");
    const missingResponse = await exports.default.fetch(missingRequest);
    expect(missingResponse.status).toBe(200);
    await expect(missingResponse.json()).resolves.toEqual({ exists: false, title: null });
  });

  it("returns a user-facing connection limit error before websocket upgrade", async () => {
    const roomId = await createRoom("Connection Limits");

    const sockets: WebSocket[] = [];

    for (let index = 0; index < 3; index++) {
      sockets.push(
        await connectParticipantSocket(roomId, "tester-limit", "test-token-limit")
      );
    }

    const connectCheckResponse = await exports.default.fetch(
      new Request(
        `http://test/api/rooms/connect?roomId=${roomId}&participantId=tester-limit&token=test-token-limit`
      )
    );

    expect(connectCheckResponse.status).toBe(429);
    await expect(connectCheckResponse.json()).resolves.toEqual({
      ok: false,
      code: "too_many_connections",
      error: "Too many active connections",
    });

    for (const socket of sockets) {
      socket.close();
    }
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
    const { ws } = await setupVoterSession(
      "Reveal Lock",
      "tester-1",
      "test-token-1",
      "Tester"
    );

    sendAction(ws, {
      action: "vote",
      participantId: "tester-1",
      vote: "3",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-1"] === "3" && !room.currentRound.revealed
    );

    sendAction(ws, {
      action: "reveal",
      participantId: "tester-1",
    });
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

    sendAction(ws, {
      action: "vote",
      participantId: "tester-1",
      vote: "5",
    });
    const errorMessage = await nextSocketMessageOfType(ws, "error");
    expect(errorMessage.error).toBe("Round already revealed");

    ws.close();
  });

  it("does not duplicate history when reveal is retried", async () => {
    const { ws } = await setupVoterSession(
      "Idempotent Reveal",
      "tester-2",
      "test-token-2",
      "Tester"
    );

    sendAction(ws, {
      action: "vote",
      participantId: "tester-2",
      vote: "3",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-2"] === "3" && !room.currentRound.revealed
    );

    sendAction(ws, {
      action: "reveal",
      participantId: "tester-2",
    });
    await nextRoomStateMatching(
      ws,
      (room) =>
        room.currentRound.revealed &&
        room.history.length === 1 &&
        room.history[0]?.aggregation === "1x3"
    );

    sendAction(ws, {
      action: "reveal",
      participantId: "tester-2",
    });

    sendAction(ws, {
      action: "reset_round",
      participantId: "tester-2",
    });

    const roomAfterReset = await nextRoomStateMatching(
      ws,
      (room) => !room.currentRound.revealed && room.currentRound.votes["tester-2"] === null
    );

    expect(roomAfterReset.history.length).toBe(1);
    expect(roomAfterReset.history[0]?.aggregation).toBe("1x3");

    ws.close();
  });

  it("clears reveal history entries", async () => {
    const { ws } = await setupVoterSession(
      "Clear History",
      "tester-clear",
      "test-token-clear",
      "Clear Tester"
    );

    sendAction(ws, {
      action: "vote",
      participantId: "tester-clear",
      vote: "5",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-clear"] === "5"
    );

    sendAction(ws, {
      action: "reveal",
      participantId: "tester-clear",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.revealed && room.history[0]?.aggregation === "1x5"
    );

    sendAction(ws, {
      action: "clear_history",
      participantId: "tester-clear",
    });

    const roomAfterClear = await nextRoomStateMatching(
      ws,
      (room) => room.history.length === 0
    );

    expect(roomAfterClear.currentRound.revealed).toBe(true);
    expect(roomAfterClear.history).toEqual([]);

    ws.close();
  });

  it("does not broadcast to existing clients on connect-only events", async () => {
    const roomId = await createRoom("No Connect Broadcast");

    const wsA = await connectParticipantSocket(roomId, "tester-a", "test-token-a");
    await joinAsVoter(wsA, "tester-a", "A");

    await drainSocketMessages(wsA);

    const unexpectedMessageForA = nextSocketMessage(wsA, 400);

    const wsB = await connectParticipantSocket(roomId, "tester-b", "test-token-b");

    await expect(unexpectedMessageForA).rejects.toThrow(
      "Timed out waiting for WebSocket message"
    );

    wsA.close();
    wsB.close();
  });

  it("ignores duplicate reset when round is already clean", async () => {
    const { ws } = await setupVoterSession(
      "Reset Idempotency",
      "tester-reset",
      "test-token-reset",
      "Tester"
    );

    await drainSocketMessages(ws);

    sendAction(ws, {
      action: "reset_round",
      participantId: "tester-reset",
    });

    await expectNoSocketMessage(ws);

    ws.close();
  });

  it("limits sockets per participant to avoid fan-out abuse", async () => {
    const roomId = await createRoom("Socket Limits");

    const ws1 = await connectParticipantSocket(roomId, "abuser", "shared-token");
    const ws2 = await connectParticipantSocket(roomId, "abuser", "shared-token");
    const ws3 = await connectParticipantSocket(roomId, "abuser", "shared-token");

    const ws4Response = await exports.default.fetch(
      websocketRequest(roomId, "abuser", "shared-token")
    );

    expect(ws4Response.status).toBe(429);

    ws1.close();
    ws2.close();
    ws3.close();
  });

  it("ignores duplicate join retries when participant data is unchanged", async () => {
    const { ws } = await setupVoterSession(
      "Join Idempotency",
      "tester-join",
      "test-token-join",
      "Join Tester"
    );

    await drainSocketMessages(ws);

    sendAction(ws, {
      action: "join",
      participantId: "tester-join",
      name: "Join Tester",
      mode: "voter",
    });

    await expectNoSocketMessage(ws);

    ws.close();
  });

  it("limits total active sockets per room", async () => {
    const roomId = await createRoom("Room Socket Limits");

    const sockets: WebSocket[] = [];

    for (let index = 0; index < 50; index++) {
      const ws = await connectParticipantSocket(
        roomId,
        `room-socket-${index}`,
        `token-${index}`
      );
      sockets.push(ws);
    }

    const overflowResponse = await exports.default.fetch(
      websocketRequest(roomId, "room-socket-overflow", "token-overflow")
    );

    expect(overflowResponse.status).toBe(429);

    for (const socket of sockets) {
      socket.close();
    }
  });

  it("ignores duplicate vote retries with same value", async () => {
    const { ws } = await setupVoterSession(
      "Vote Idempotency",
      "tester-vote",
      "test-token-vote",
      "Vote Tester"
    );

    sendAction(ws, {
      action: "vote",
      participantId: "tester-vote",
      vote: "5",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-vote"] === "5"
    );

    await drainSocketMessages(ws);

    sendAction(ws, {
      action: "vote",
      participantId: "tester-vote",
      vote: "5",
    });

    await expectNoSocketMessage(ws);

    ws.close();
  });

  it("excludes spectator votes from reveal aggregation", async () => {
    const { ws } = await setupVoterSession(
      "Spectator Aggregation",
      "tester-spec",
      "test-token-spec",
      "Spec Tester"
    );

    sendAction(ws, {
      action: "vote",
      participantId: "tester-spec",
      vote: "5",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-spec"] === "5"
    );

    sendAction(ws, {
      action: "set_mode",
      participantId: "tester-spec",
      mode: "spectator",
    });
    await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.votes["tester-spec"] === null
    );

    sendAction(ws, {
      action: "reveal",
      participantId: "tester-spec",
    });

    const revealedRoom = await nextRoomStateMatching(
      ws,
      (room) => room.currentRound.revealed && room.history.length > 0
    );

    expect(revealedRoom.history[0]?.aggregation).toBe("no votes");

    ws.close();
  });
});
