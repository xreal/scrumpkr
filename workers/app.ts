import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (
      url.pathname.startsWith("/ws/") &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const roomId = url.pathname.slice("/ws/".length);
      if (!roomId) {
        return new Response("Missing room ID", { status: 400 });
      }
      const id = env.POKER_ROOM.idFromName(roomId);
      const stub = env.POKER_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const roomId = generateRoomId();
      const id = env.POKER_ROOM.idFromName(roomId);
      const stub = env.POKER_ROOM.get(id);
      const createUrl = new URL(request.url);
      createUrl.searchParams.set("roomId", roomId);
      const roomRequest = new Request(createUrl.toString(), request);
      const response = await stub.fetch(roomRequest);
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers.entries()), "X-Room-Id": roomId },
      });
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;

function generateRoomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

const OFFLINE_PARTICIPANT_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const VALID_VOTES = new Set([
  "0",
  "0.5",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "100",
  "?",
  "coffee",
]);

export class PokerRoom implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private roomData: RoomData;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
    this.roomData = {
      roomId: "",
      createdAt: 0,
      updatedAt: 0,
      title: "",
      participants: [],
      currentRound: { revealed: false, votes: {} },
      history: [],
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

      const participantId =
        url.searchParams.get("participantId") || crypto.randomUUID();
      const roomIdFromPath = url.pathname.startsWith("/ws/")
        ? url.pathname.slice("/ws/".length)
        : "";

      await this.state.blockConcurrencyWhile(async () => {
        await this.loadFromStorage();
        let changed = false;
        if (roomIdFromPath && !this.roomData.roomId) {
          this.roomData.roomId = roomIdFromPath;
          changed = true;
        }
        if (this.roomData.createdAt === 0) {
          this.roomData.createdAt = Date.now();
          changed = true;
        }

        const existing = this.roomData.participants.find(
          (p) => p.participantId === participantId
        );
        if (existing) {
          existing.connected = true;
          existing.lastSeenAt = Date.now();
          changed = true;
        }

        if (this.pruneInactiveParticipants(Date.now())) {
          changed = true;
        }

        if (changed) {
          this.roomData.updatedAt = Date.now();
          await this.saveToStorage();
        }
      });

      this.state.acceptWebSocket(server, [participantId]);
      server.send(
        JSON.stringify({
          type: "room_state",
          room: this.sanitizedRoom(),
          yourId: participantId,
        })
      );
      this.broadcastRoomState();

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      await this.state.blockConcurrencyWhile(async () => {
        await this.loadFromStorage();
        const body = (await request.json()) as { title?: string };
        this.roomData.roomId = url.searchParams.get("roomId") || this.roomData.roomId;
        if (this.roomData.createdAt === 0) {
          this.roomData.createdAt = Date.now();
        }
        this.roomData.updatedAt = Date.now();
        this.roomData.title = body.title || "";
        await this.saveToStorage();
      });
      return new Response(JSON.stringify({ roomId: this.roomData.roomId }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let data: ClientMessage;
    try {
      data = JSON.parse(
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message)
      ) as ClientMessage;
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid message payload" }));
      return;
    }

    const wsParticipantId = this.state.getTags(ws)[0];
    if (!wsParticipantId) {
      ws.close(1008, "Missing participant identity");
      return;
    }

    if (data.participantId && data.participantId !== wsParticipantId) {
      ws.send(JSON.stringify({ type: "error", error: "Participant mismatch" }));
      return;
    }

    await this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });

    const participant = this.roomData.participants.find(
      (p) => p.participantId === wsParticipantId
    );

    if (data.action !== "join" && !participant) {
      ws.send(JSON.stringify({ type: "error", error: "Join room first" }));
      return;
    }

    let changed = false;

    switch (data.action) {
      case "join": {
        const existing = this.roomData.participants.find(
          (p) => p.participantId === wsParticipantId
        );
        const name = sanitizeName(data.name);

        if (!existing) {
          this.roomData.participants.push({
            participantId: wsParticipantId,
            name: name || "Anonymous",
            role: "admin",
            mode: data.mode || "voter",
            connected: true,
            lastSeenAt: Date.now(),
          });
          this.roomData.currentRound.votes[wsParticipantId] = null;
          changed = true;
        } else {
          existing.connected = true;
          existing.lastSeenAt = Date.now();
          if (name) existing.name = name;
          if (data.mode) existing.mode = data.mode;
          changed = true;
        }
        break;
      }
      case "rejoin": {
        const name = sanitizeName(data.name);
        if (participant) {
          participant.connected = true;
          participant.lastSeenAt = Date.now();
          if (name) participant.name = name;
          changed = true;
        }
        break;
      }
      case "set_name": {
        const name = sanitizeName(data.name);
        if (participant && name) {
          participant.name = name;
          changed = true;
        }
        break;
      }
      case "set_mode": {
        if (participant && data.mode) {
          participant.mode = data.mode;
          changed = true;
        }
        break;
      }
      case "set_title": {
        this.roomData.title = sanitizeTitle(data.title);
        changed = true;
        break;
      }
      case "vote": {
        if (!participant || participant.mode !== "voter") {
          break;
        }
        if (!isValidVote(data.vote)) {
          ws.send(JSON.stringify({ type: "error", error: "Invalid vote value" }));
          break;
        }
        this.roomData.currentRound.votes[wsParticipantId] = data.vote ?? null;
        changed = true;
        break;
      }
      case "reveal": {
        this.roomData.currentRound.revealed = true;
        const votes = Object.values(this.roomData.currentRound.votes);
        const agg = aggregateReveal(votes);
        this.roomData.history.unshift({
          timestamp: Date.now(),
          aggregation: agg,
        });
        if (this.roomData.history.length > 10) {
          this.roomData.history = this.roomData.history.slice(0, 10);
        }
        changed = true;
        break;
      }
      case "reset_round": {
        this.roomData.currentRound = { revealed: false, votes: {} };
        for (const p of this.roomData.participants) {
          this.roomData.currentRound.votes[p.participantId] = null;
        }
        changed = true;
        break;
      }
      case "remove_participant": {
        if (data.removeId) {
          const target = this.roomData.participants.find(
            (p) => p.participantId === data.removeId
          );
          if (!target || target.connected) {
            break;
          }

          this.roomData.participants = this.roomData.participants.filter(
            (p) => p.participantId !== data.removeId
          );
          delete this.roomData.currentRound.votes[data.removeId];
          for (const targetWs of this.getSocketsForParticipant(data.removeId)) {
            targetWs.close(1000, "Removed from room");
          }
          changed = true;
        }
        break;
      }
      default: {
        ws.send(JSON.stringify({ type: "error", error: "Unknown action" }));
        return;
      }
    }

    if (this.pruneInactiveParticipants(Date.now())) {
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.roomData.updatedAt = Date.now();
    await this.state.blockConcurrencyWhile(async () => {
      await this.saveToStorage();
    });
    this.broadcastRoomState();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const tags = this.state.getTags(ws);
    const participantId = tags[0];
    if (participantId) {
      await this.state.blockConcurrencyWhile(async () => {
        await this.loadFromStorage();
        let changed = false;

        const p = this.roomData.participants.find(
          (participant) => participant.participantId === participantId
        );
        if (p && p.connected) {
          p.connected = false;
          p.lastSeenAt = Date.now();
          changed = true;
        }

        if (this.pruneInactiveParticipants(Date.now())) {
          changed = true;
        }

        if (changed) {
          this.roomData.updatedAt = Date.now();
          await this.saveToStorage();
        }
      });
      this.broadcastRoomState();
    }
  }

  private broadcastRoomState() {
    const msg = JSON.stringify({ type: "room_state", room: this.sanitizedRoom() });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        ws.close(1011, "Broadcast failed");
      }
    }
  }

  private getSocketsForParticipant(participantId: string): WebSocket[] {
    return this.state
      .getWebSockets()
      .filter((ws) => this.state.getTags(ws).includes(participantId));
  }

  private pruneInactiveParticipants(now: number): boolean {
    const staleBefore = now - OFFLINE_PARTICIPANT_TTL_MS;
    const staleIds = this.roomData.participants
      .filter((participant) => !participant.connected && participant.lastSeenAt < staleBefore)
      .map((participant) => participant.participantId);

    if (staleIds.length === 0) {
      return false;
    }

    this.roomData.participants = this.roomData.participants.filter(
      (participant) => !staleIds.includes(participant.participantId)
    );

    for (const staleId of staleIds) {
      delete this.roomData.currentRound.votes[staleId];
    }

    return true;
  }

  private sanitizedRoom(): RoomData {
    const votes = { ...this.roomData.currentRound.votes };
    if (!this.roomData.currentRound.revealed) {
      for (const key of Object.keys(votes)) {
        if (votes[key] !== null) {
          votes[key] = "hidden" as string | null;
        }
      }
    }
    return {
      ...this.roomData,
      currentRound: { ...this.roomData.currentRound, votes },
    };
  }

  private async loadFromStorage() {
    const stored = await this.storage.get<RoomData>("room");
    if (stored) {
      this.roomData = stored;
    }
  }

  private async saveToStorage() {
    await this.storage.put("room", this.roomData);
  }
}

interface RoomData {
  roomId: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  participants: ParticipantData[];
  currentRound: RoundData;
  history: RevealEntryData[];
}

interface ParticipantData {
  participantId: string;
  name: string;
  role: "admin";
  mode: "voter" | "spectator";
  connected: boolean;
  lastSeenAt: number;
}

interface RoundData {
  revealed: boolean;
  votes: Record<string, string | null>;
}

interface RevealEntryData {
  timestamp: number;
  aggregation: string;
}

interface ClientMessage {
  action: "join" | "rejoin" | "set_name" | "set_mode" | "set_title" | "vote" | "reveal" | "reset_round" | "remove_participant";
  participantId: string;
  name?: string;
  mode?: "voter" | "spectator";
  title?: string;
  vote?: string | null;
  removeId?: string;
}

function sanitizeName(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 40);
}

function sanitizeTitle(title?: string): string {
  if (!title) return "";
  return title.trim().slice(0, 120);
}

function isValidVote(vote?: string | null): boolean {
  if (vote == null) return true;
  return VALID_VOTES.has(vote);
}

function aggregateReveal(votes: (string | null)[]): string {
  const counts: Record<string, number> = {};
  for (const v of votes) {
    if (v == null) continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([val, count]) => `${count}x${val}`);
  return parts.length > 0 ? parts.join(", ") : "no votes";
}
