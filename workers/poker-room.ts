import type { ClientMessage, Room } from "../app/lib/types";
import {
  aggregateReveal,
  isValidVote,
  sanitizeName,
  sanitizeTitle,
} from "../app/lib/vote-logic";

const WS_PATH_PREFIX = "/ws/";
const ROOMS_PATH = "/api/rooms";
const ROOM_EXISTS_PATH = "/api/rooms/exists";
const ROOM_CONNECT_PATH = "/api/rooms/connect";

const HISTORY_LIMIT = 10;
const OFFLINE_PARTICIPANT_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SOCKETS_PER_PARTICIPANT = 3;
const MAX_SOCKETS_PER_ROOM = 50;

const CLIENT_ACTIONS = [
  "join",
  "rejoin",
  "set_name",
  "set_mode",
  "set_title",
  "vote",
  "reveal",
  "reset_round",
  "clear_history",
  "remove_participant",
  "poke",
] as const;

type IncomingClientMessage = Omit<ClientMessage, "participantId"> & {
  participantId?: string;
};

type ParticipantData = Room["participants"][number] & {
  authToken?: string;
};

type RoomData = Omit<Room, "participants"> & {
  participants: ParticipantData[];
};

interface ActionResult {
  changed: boolean;
  error?: string;
  socketsToClose?: WebSocket[];
}

function createInitialRoomData(): RoomData {
  return {
    roomId: "",
    createdAt: 0,
    updatedAt: 0,
    title: "",
    participants: [],
    currentRound: { revealed: false, votes: {} },
    history: [],
  };
}

function isClientAction(action: unknown): action is ClientMessage["action"] {
  return (
    typeof action === "string" &&
    (CLIENT_ACTIONS as readonly string[]).includes(action)
  );
}

function isIncomingClientMessage(value: unknown): value is IncomingClientMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { action?: unknown };
  return isClientAction(candidate.action);
}

function parseClientMessage(message: string | ArrayBuffer): IncomingClientMessage | null {
  const payload =
    typeof message === "string" ? message : new TextDecoder().decode(message);

  try {
    const parsed = JSON.parse(payload) as unknown;
    return isIncomingClientMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isWebSocketUpgradeRequest(request: Request): boolean {
  return request.headers.get("Upgrade") === "websocket";
}

function roomIdFromWebSocketPath(pathname: string): string {
  if (!pathname.startsWith(WS_PATH_PREFIX)) {
    return "";
  }

  return pathname.slice(WS_PATH_PREFIX.length);
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class PokerRoom implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private roomData: RoomData;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
    this.roomData = createInitialRoomData();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === ROOM_EXISTS_PATH && request.method === "GET") {
      return this.handleRoomExistsRequest(url);
    }

    if (url.pathname === ROOM_CONNECT_PATH && request.method === "GET") {
      return this.handleRoomConnectRequest(url);
    }

    if (isWebSocketUpgradeRequest(request)) {
      return this.handleWebSocketUpgrade(request, url);
    }

    if (url.pathname === ROOMS_PATH && request.method === "POST") {
      return this.handleCreateRoomRequest(request, url);
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = parseClientMessage(message);
    if (!data) {
      ws.send(JSON.stringify({ type: "error", error: "Invalid message payload" }));
      return;
    }

    const [wsParticipantId, wsParticipantToken = ""] = this.state.getTags(ws);
    if (!wsParticipantId) {
      ws.close(1008, "Missing participant identity");
      return;
    }

    if (data.participantId && data.participantId !== wsParticipantId) {
      ws.send(JSON.stringify({ type: "error", error: "Participant mismatch" }));
      return;
    }

    let errorMessage: string | null = null;
    let shouldBroadcast = false;
    let socketsToClose: WebSocket[] = [];
    let isPoke = false;

    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();

      if (data.action !== "join" && !this.getParticipant(wsParticipantId)) {
        errorMessage = "Join room first";
        return;
      }

      if (data.action === "poke") {
        isPoke = true;
        if (data.targetId) {
          const fromParticipant = this.getParticipant(wsParticipantId);
          for (const targetSocket of this.getSocketsForParticipant(data.targetId)) {
            targetSocket.send(
              JSON.stringify({
                type: "poke",
                fromName: fromParticipant?.name || "Someone",
              })
            );
          }
        }
        return;
      }

      const actionResult = this.applyClientAction(
        data,
        wsParticipantId,
        wsParticipantToken
      );

      if (actionResult.error) {
        errorMessage = actionResult.error;
        return;
      }

      socketsToClose = actionResult.socketsToClose ?? [];
      let changed = actionResult.changed;

      const now = Date.now();
      if (this.pruneInactiveParticipants(now)) {
        changed = true;
      }

      if (!changed) {
        return;
      }

      this.roomData.updatedAt = now;
      await this.saveToStorage();
      shouldBroadcast = true;
    });

    if (isPoke) {
      return;
    }

    if (errorMessage) {
      ws.send(JSON.stringify({ type: "error", error: errorMessage }));
      return;
    }

    for (const targetSocket of socketsToClose) {
      targetSocket.close(1000, "Removed from room");
    }

    if (shouldBroadcast) {
      this.broadcastRoomState();
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    const [participantId] = this.state.getTags(ws);
    if (!participantId) {
      return;
    }

    let shouldBroadcast = false;

    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();

      const hasOtherActiveSockets = this.state.getWebSockets().some((socket) => {
        if (socket === ws) {
          return false;
        }

        const [socketParticipantId] = this.state.getTags(socket);
        return socketParticipantId === participantId;
      });

      let changed = false;

      if (!hasOtherActiveSockets) {
        const participant = this.getParticipant(participantId);
        if (participant && participant.connected) {
          participant.connected = false;
          participant.lastSeenAt = Date.now();
          changed = true;
        }
      }

      if (this.pruneInactiveParticipants(Date.now())) {
        changed = true;
      }

      if (!changed) {
        return;
      }

      this.roomData.updatedAt = Date.now();
      await this.saveToStorage();
      shouldBroadcast = true;
    });

    if (shouldBroadcast) {
      this.broadcastRoomState();
    }
  }

  private async handleRoomExistsRequest(url: URL): Promise<Response> {
    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });

    const requestedRoomId = url.searchParams.get("roomId")?.trim();
    const exists =
      !!requestedRoomId &&
      this.roomData.createdAt > 0 &&
      this.roomData.roomId === requestedRoomId;

    return jsonResponse({
      exists,
      title: exists ? this.roomData.title || null : null,
    });
  }

  private async handleRoomConnectRequest(url: URL): Promise<Response> {
    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });

    const requestedRoomId = url.searchParams.get("roomId")?.trim();
    const participantId = url.searchParams.get("participantId")?.trim() || "";
    const participantToken = url.searchParams.get("token")?.trim() || "";
    const roomExists =
      !!requestedRoomId &&
      this.roomData.createdAt > 0 &&
      this.roomData.roomId === requestedRoomId;

    if (!roomExists) {
      return jsonResponse(
        { ok: false, code: "room_not_found", error: "Room not found" },
        404
      );
    }

    if (this.state.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) {
      return jsonResponse(
        { ok: false, code: "room_full", error: "Room is full" },
        429
      );
    }

    if (participantId) {
      const existingParticipant = this.getParticipant(participantId);
      const hasAuthMismatch =
        !!existingParticipant?.authToken && existingParticipant.authToken !== participantToken;

      if (!hasAuthMismatch) {
        const participantSocketCount = this.getSocketsForParticipant(participantId).length;
        if (participantSocketCount >= MAX_SOCKETS_PER_PARTICIPANT) {
          return jsonResponse(
            {
              ok: false,
              code: "too_many_connections",
              error: "Too many active connections",
            },
            429
          );
        }
      }
    }

    return jsonResponse({ ok: true });
  }

  private async handleWebSocketUpgrade(
    request: Request,
    url: URL
  ): Promise<Response> {
    const roomId = roomIdFromWebSocketPath(url.pathname);
    if (!roomId) {
      return new Response("Room not found", { status: 404 });
    }

    let participantId = url.searchParams.get("participantId") || crypto.randomUUID();
    let participantToken = url.searchParams.get("token") || "";
    let roomExists = false;
    let shouldBroadcast = false;

    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();

      roomExists =
        this.roomData.createdAt > 0 && this.roomData.roomId === roomId;

      if (!roomExists) {
        return;
      }

      const now = Date.now();
      const identity = this.reconcileSocketIdentity(
        participantId,
        participantToken,
        now
      );
      participantId = identity.participantId;
      participantToken = identity.participantToken;

      let changed = identity.changed;
      if (this.pruneInactiveParticipants(now)) {
        changed = true;
      }

      if (!changed) {
        return;
      }

      this.roomData.updatedAt = now;
      await this.saveToStorage();
      shouldBroadcast = true;
    });

    if (!roomExists) {
      return new Response("Room not found", { status: 404 });
    }

    if (this.state.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) {
      return new Response("Room is full", { status: 429 });
    }

    const participantSocketCount = this.getSocketsForParticipant(participantId).length;
    if (participantSocketCount >= MAX_SOCKETS_PER_PARTICIPANT) {
      return new Response("Too many active connections", { status: 429 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.state.acceptWebSocket(server, [participantId, participantToken]);
    server.send(
      JSON.stringify({
        type: "room_state",
        room: this.sanitizedRoomForParticipant(participantId),
        yourId: participantId,
        yourVote: this.getParticipantVote(participantId),
        yourToken: participantToken,
      })
    );

    if (shouldBroadcast) {
      this.broadcastRoomState();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleCreateRoomRequest(
    request: Request,
    url: URL
  ): Promise<Response> {
    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();

      const body = (await readJsonBody<{ title?: string }>(request)) ?? {};
      this.roomData.roomId =
        url.searchParams.get("roomId") || this.roomData.roomId;

      if (this.roomData.createdAt === 0) {
        this.roomData.createdAt = Date.now();
      }

      this.roomData.updatedAt = Date.now();
      this.roomData.title = sanitizeTitle(body.title);
      await this.saveToStorage();
    });

    return jsonResponse({ roomId: this.roomData.roomId });
  }

  private applyClientAction(
    data: IncomingClientMessage,
    wsParticipantId: string,
    wsParticipantToken: string
  ): ActionResult {
    const participant = this.getParticipant(wsParticipantId);

    switch (data.action) {
      case "join":
        return this.handleJoinAction(data, wsParticipantId, wsParticipantToken);
      case "rejoin":
        return this.handleRejoinAction(data, participant);
      case "set_name":
        return this.handleSetNameAction(data, participant);
      case "set_mode":
        return this.handleSetModeAction(data, participant);
      case "set_title":
        return this.handleSetTitleAction(data);
      case "vote":
        return this.handleVoteAction(data, wsParticipantId, participant);
      case "reveal":
        return this.handleRevealAction();
      case "reset_round":
        return this.handleResetRoundAction();
      case "clear_history":
        return this.handleClearHistoryAction();
      case "remove_participant":
        return this.handleRemoveParticipantAction(data, wsParticipantId);
      default:
        return { changed: false, error: "Unknown action" };
    }
  }

  private handleJoinAction(
    data: IncomingClientMessage,
    wsParticipantId: string,
    wsParticipantToken: string
  ): ActionResult {
    const existing = this.getParticipant(wsParticipantId);
    const name = sanitizeName(data.name);

    if (!existing) {
      this.roomData.participants.push({
        participantId: wsParticipantId,
        name: name || "Anonymous",
        role: "admin",
        mode: data.mode || "voter",
        connected: true,
        lastSeenAt: Date.now(),
        authToken: wsParticipantToken || crypto.randomUUID(),
      });
      this.roomData.currentRound.votes[wsParticipantId] = null;
      return { changed: true };
    }

    if (existing.authToken && existing.authToken !== wsParticipantToken) {
      return { changed: false, error: "Auth mismatch" };
    }

    let changed = false;

    if (!existing.connected) {
      existing.connected = true;
      changed = true;
    }

    if (name && name !== existing.name) {
      existing.name = name;
      changed = true;
    }

    if (data.mode && data.mode !== existing.mode) {
      existing.mode = data.mode;
      changed = true;
    }

    if (!existing.authToken) {
      existing.authToken = wsParticipantToken || crypto.randomUUID();
      changed = true;
    }

    if (changed) {
      existing.lastSeenAt = Date.now();
    }

    return { changed };
  }

  private handleRejoinAction(
    data: IncomingClientMessage,
    participant?: ParticipantData
  ): ActionResult {
    const name = sanitizeName(data.name);
    if (!participant) {
      return { changed: false };
    }

    participant.connected = true;
    participant.lastSeenAt = Date.now();
    if (name) {
      participant.name = name;
    }

    return { changed: true };
  }

  private handleSetNameAction(
    data: IncomingClientMessage,
    participant?: ParticipantData
  ): ActionResult {
    const name = sanitizeName(data.name);
    if (!participant || !name) {
      return { changed: false };
    }

    participant.name = name;
    return { changed: true };
  }

  private handleSetModeAction(
    data: IncomingClientMessage,
    participant?: ParticipantData
  ): ActionResult {
    if (!participant || !data.mode) {
      return { changed: false };
    }

    if (participant.mode === data.mode) {
      return { changed: false };
    }

    participant.mode = data.mode;

    if (participant.mode === "spectator") {
      this.roomData.currentRound.votes[participant.participantId] = null;
    }

    if (!(participant.participantId in this.roomData.currentRound.votes)) {
      this.roomData.currentRound.votes[participant.participantId] = null;
    }

    return { changed: true };
  }

  private getCurrentRoundVotesForVoters(): (string | null)[] {
    return this.roomData.participants
      .filter((participant) => participant.mode === "voter")
      .map(
        (participant) =>
          this.roomData.currentRound.votes[participant.participantId] ?? null
      );
  }

  private handleSetTitleAction(data: IncomingClientMessage): ActionResult {
    this.roomData.title = sanitizeTitle(data.title);
    return { changed: true };
  }

  private handleVoteAction(
    data: IncomingClientMessage,
    wsParticipantId: string,
    participant?: ParticipantData
  ): ActionResult {
    if (!participant || participant.mode !== "voter") {
      return { changed: false };
    }

    if (this.roomData.currentRound.revealed) {
      return { changed: false, error: "Round already revealed" };
    }

    if (!isValidVote(data.vote)) {
      return { changed: false, error: "Invalid vote value" };
    }

    const nextVote = data.vote ?? null;
    const currentVote = this.roomData.currentRound.votes[wsParticipantId] ?? null;
    if (currentVote === nextVote) {
      return { changed: false };
    }

    this.roomData.currentRound.votes[wsParticipantId] = nextVote;
    return { changed: true };
  }

  private handleRevealAction(): ActionResult {
    if (this.roomData.currentRound.revealed) {
      return { changed: false };
    }

    this.roomData.currentRound.revealed = true;

    const votes = this.getCurrentRoundVotesForVoters();
    const aggregation = aggregateReveal(votes);

    this.roomData.history.unshift({
      timestamp: Date.now(),
      aggregation,
    });

    if (this.roomData.history.length > HISTORY_LIMIT) {
      this.roomData.history = this.roomData.history.slice(0, HISTORY_LIMIT);
    }

    return { changed: true };
  }

  private handleResetRoundAction(): ActionResult {
    const participantIds = this.roomData.participants.map(
      (participant) => participant.participantId
    );

    const currentVotes = this.roomData.currentRound.votes;
    const hasAllParticipantVotes = participantIds.every(
      (participantId) => currentVotes[participantId] === null
    );

    const hasOnlyParticipantVotes =
      Object.keys(currentVotes).length === participantIds.length;

    if (
      !this.roomData.currentRound.revealed &&
      hasAllParticipantVotes &&
      hasOnlyParticipantVotes
    ) {
      return { changed: false };
    }

    this.roomData.currentRound = { revealed: false, votes: {} };
    for (const participant of this.roomData.participants) {
      this.roomData.currentRound.votes[participant.participantId] = null;
    }

    return { changed: true };
  }

  private handleClearHistoryAction(): ActionResult {
    if (this.roomData.history.length === 0) {
      return { changed: false };
    }

    this.roomData.history = [];
    return { changed: true };
  }

  private handleRemoveParticipantAction(
    data: IncomingClientMessage,
    wsParticipantId: string
  ): ActionResult {
    if (!data.removeId) {
      return { changed: false };
    }

    const target = this.getParticipant(data.removeId);
    if (!target || target.participantId === wsParticipantId) {
      return { changed: false };
    }

    this.roomData.participants = this.roomData.participants.filter(
      (participant) => participant.participantId !== data.removeId
    );
    delete this.roomData.currentRound.votes[data.removeId];

    return {
      changed: true,
      socketsToClose: this.getSocketsForParticipant(data.removeId),
    };
  }

  private reconcileSocketIdentity(
    participantId: string,
    participantToken: string,
    now: number
  ): { participantId: string; participantToken: string; changed: boolean } {
    const existingParticipant = this.getParticipant(participantId);

    if (!existingParticipant) {
      return {
        participantId,
        participantToken: participantToken || crypto.randomUUID(),
        changed: false,
      };
    }

    if (
      existingParticipant.authToken &&
      existingParticipant.authToken !== participantToken
    ) {
      return {
        participantId: crypto.randomUUID(),
        participantToken: crypto.randomUUID(),
        changed: false,
      };
    }

    existingParticipant.connected = true;
    existingParticipant.lastSeenAt = now;

    if (!existingParticipant.authToken) {
      existingParticipant.authToken = participantToken || crypto.randomUUID();
    }

    return {
      participantId,
      participantToken: existingParticipant.authToken,
      changed: true,
    };
  }

  private getParticipant(participantId: string): ParticipantData | undefined {
    return this.roomData.participants.find(
      (participant) => participant.participantId === participantId
    );
  }

  private broadcastRoomState() {
    for (const ws of this.state.getWebSockets()) {
      try {
        const [participantId] = this.state.getTags(ws);
        ws.send(
          JSON.stringify({
            type: "room_state",
            room: this.sanitizedRoomForParticipant(participantId),
            yourVote: this.getParticipantVote(participantId),
            yourToken: this.getParticipantToken(participantId),
          })
        );
      } catch {
        ws.close(1011, "Broadcast failed");
      }
    }
  }

  private getSocketsForParticipant(participantId: string): WebSocket[] {
    return this.state.getWebSockets().filter((ws) => {
      const [socketParticipantId] = this.state.getTags(ws);
      return socketParticipantId === participantId;
    });
  }

  private pruneInactiveParticipants(now: number): boolean {
    const staleBefore = now - OFFLINE_PARTICIPANT_TTL_MS;
    const staleParticipantIds = new Set(
      this.roomData.participants
        .filter(
          (participant) =>
            !participant.connected && participant.lastSeenAt < staleBefore
        )
        .map((participant) => participant.participantId)
    );

    if (staleParticipantIds.size === 0) {
      return false;
    }

    this.roomData.participants = this.roomData.participants.filter(
      (participant) => !staleParticipantIds.has(participant.participantId)
    );

    for (const staleParticipantId of staleParticipantIds) {
      delete this.roomData.currentRound.votes[staleParticipantId];
    }

    return true;
  }

  private sanitizedRoomForParticipant(participantId?: string): Room {
    const votes = { ...this.roomData.currentRound.votes };
    if (!this.roomData.currentRound.revealed) {
      for (const voteParticipantId of Object.keys(votes)) {
        if (voteParticipantId !== participantId && votes[voteParticipantId] !== null) {
          votes[voteParticipantId] = "hidden";
        }
      }
    }

    return {
      ...this.roomData,
      participants: this.roomData.participants.map((participant) => ({
        participantId: participant.participantId,
        name: participant.name,
        role: participant.role,
        mode: participant.mode,
        connected: participant.connected,
        lastSeenAt: participant.lastSeenAt,
      })),
      currentRound: { ...this.roomData.currentRound, votes },
    };
  }

  private getParticipantVote(participantId?: string): string | null {
    if (!participantId) {
      return null;
    }

    return this.roomData.currentRound.votes[participantId] ?? null;
  }

  private getParticipantToken(participantId?: string): string | null {
    if (!participantId) {
      return null;
    }

    return this.getParticipant(participantId)?.authToken ?? null;
  }

  private async loadFromStorage() {
    const storedRoom = await this.storage.get<RoomData>("room");
    if (storedRoom) {
      this.roomData = storedRoom;
    }
  }

  private async saveToStorage() {
    await this.storage.put("room", this.roomData);
  }
}
