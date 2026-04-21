import { createRequestHandler } from "react-router";
import { PokerRoom } from "./poker-room";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const WS_PATH_PREFIX = "/ws/";
const ROOMS_PATH = "/api/rooms";
const ROOM_EXISTS_PATH = "/api/rooms/exists";
const ROOM_ID_HEADER = "X-Room-Id";

const ROOM_ID_LENGTH = 16;
const ROOM_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export { PokerRoom };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (isWebSocketRoomRequest(request, url.pathname)) {
      const roomId = roomIdFromWebSocketPath(url.pathname);
      if (!roomId) {
        return new Response("Missing room ID", { status: 400 });
      }

      return forwardToRoom(env, roomId, request);
    }

    if (url.pathname === ROOMS_PATH && request.method === "POST") {
      return createRoom(env, request);
    }

    if (url.pathname === ROOM_EXISTS_PATH && request.method === "GET") {
      const roomId = url.searchParams.get("roomId")?.trim();
      if (!roomId) {
        return jsonResponse({ exists: false }, 400);
      }

      return forwardToRoom(env, roomId, request);
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;

function isWebSocketRoomRequest(request: Request, pathname: string): boolean {
  return (
    pathname.startsWith(WS_PATH_PREFIX) &&
    request.headers.get("Upgrade") === "websocket"
  );
}

function roomIdFromWebSocketPath(pathname: string): string {
  if (!pathname.startsWith(WS_PATH_PREFIX)) {
    return "";
  }

  return pathname.slice(WS_PATH_PREFIX.length);
}

function getRoomStub(env: Env, roomId: string): DurableObjectStub {
  const id = env.POKER_ROOM.idFromName(roomId);
  return env.POKER_ROOM.get(id);
}

function forwardToRoom(env: Env, roomId: string, request: Request): Promise<Response> {
  return getRoomStub(env, roomId).fetch(request);
}

async function createRoom(env: Env, request: Request): Promise<Response> {
  const roomId = generateRoomId();
  const stub = getRoomStub(env, roomId);

  const createUrl = new URL(request.url);
  createUrl.searchParams.set("roomId", roomId);
  const createRequest = new Request(createUrl.toString(), request);

  const response = await stub.fetch(createRequest);
  const headers = new Headers(response.headers);
  headers.set(ROOM_ID_HEADER, roomId);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function generateRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(bytes);

  let roomId = "";
  for (const byte of bytes) {
    roomId += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length];
  }

  return roomId;
}
