# scrumpkr.net — Agent Guidelines

## Project
Minimalist, no-login Planning Poker for agile teams. Persistent rooms, real-time voting, link-sharing.

## Tech Stack
- **Runtime**: Cloudflare Workers (edge-native, stateless HTTP layer)
- **Real-time + State**: Cloudflare Durable Objects (1 per room) with SQLite-backed storage
- **Frontend**: React 19, React Router 7 (framework mode), TypeScript, Tailwind CSS v4
- **Build**: Vite, Wrangler
- **Testing**: Vitest (unit + integration), React Testing Library (DOM assertions)
- **Package Manager**: pnpm

## Architecture
```
Worker (stateless) → Durable Object (1 per room) → SQLite storage
         ↓                    ↓
    HTTP / SSR          WebSocket hibernation
```
- Worker handles HTTP, API, and WebSocket upgrade routing.
- `PokerRoom` Durable Object owns all room state, WebSocket connections, and persistence.
- No external database. No Redis. No sessions.
- Reconnect identity is secured via per-participant `authToken` persisted in `localStorage` (`app/lib/storage.ts`).

## Code Conventions
- **Strict TypeScript**: No `any`. Define interfaces in `app/lib/types.ts`.
- **Explicit naming**: `participantId`, not `id`. `roomData`, not `data`.
- **Immutability**: Prefer spreading over mutation. State updates in DO must be saved to storage explicitly.
- **Small components**: One file per component. Colocate hooks and helpers.
- **No magic numbers**: Extract constants (TTLs, limits) to top-level `const`.
- **Error handling**: Return actionable errors over WebSocket (`{ type: "error", error: "..." }`). Never swallow exceptions silently.
- **Pure business logic**: Extract validation, aggregation, and sanitization to `app/lib/vote-logic.ts`. Keep DO handlers thin.

## State Management Rules
- **DO is the single source of truth**. Client is a thin projection.
- After every mutating action: update `roomData`, `saveToStorage()`, then `broadcastRoomState()`.
- Use `blockConcurrencyWhile` around read-modify-write in DO.
- Sanitize all user inputs at the boundary (`sanitizeName`, `sanitizeTitle`, `isValidVote`).
- **Bound hot paths**: Enforce `MAX_SOCKETS_PER_ROOM = 50` and `MAX_SOCKETS_PER_PARTICIPANT = 3`.

## WebSocket Protocol
- Client sends actions: `join`, `rejoin`, `set_name`, `set_mode`, `set_title`, `vote`, `reveal`, `reset_round`, `remove_participant`, `clear_history`, `poke`.
- Server message types:
  - `room_state` — full room snapshot after every change.
  - `error` — actionable failure reason.
  - `poke` — ephemeral nudge from one participant to another.
- No deltas in V1.
- Reconnect logic lives in `useWebSocket` (2s exponential backoff, capped at 30s).
- Client performs a pre-flight `GET /api/rooms/connect` before upgrading to WebSocket to validate room existence and connection limits.

## File Organization
```
workers/app.ts          # Worker entry (HTTP routing, SSR, WS upgrade forwarding)
workers/poker-room.ts   # Durable Object (state, WebSocket lifecycle, persistence)
app/routes/             # Page routes (React Router)
app/components/         # UI components (grouped by feature)
app/hooks/              # Reusable hooks
app/lib/                # Types, storage helpers, deck config, pure logic
```
- Colocate `*.test.ts` next to the file under test.

## Testing Philosophy
- **Test tool**: Vitest (native Vite integration, fast, modern).
- **New code should have tests**: Every new component, hook, or TypeScript utility *should* include at least one meaningful test.
- **Don't overtest**: Skip trivial tests (e.g., "button renders"). Focus on:
  - Business logic (vote validation, aggregation, sanitization)
  - State transitions (Durable Object actions)
  - User flows (join → vote → reveal)
  - Edge cases (reconnect, invalid input, empty state)
- **DO testing**: Use Miniflare's Durable Object testing utilities for integration tests against `PokerRoom`.
- **Keep tests close**: Colocate `*.test.ts` next to the file under test.

## Scaling Principles
- Stateless worker layer scales infinitely.
- Durable Objects isolate rooms — no cross-room queries.
- WebSocket hibernation keeps idle rooms near-zero cost.
- Keep DO storage small (< 1MB). History capped at 10 entries. Prune stale participants (30-day TTL).
- Avoid Cron. Avoid external APIs. Avoid heavy computation in DO.

## Durable Object Rules (keep this generic)
- **One DO = one coordination atom**: Model by room/session/entity. Never create one global DO for all traffic.
- **Idempotent actions first**: Retries and duplicate messages happen. Mutations like `reveal`, `reset_round`, `vote` should be safe when repeated.
- **Persist critical state before risky work**: In-memory state can be lost on eviction/crash; storage is the durable source of truth.
- **Use `blockConcurrencyWhile` only for read-modify-write critical sections**: Keep read-only paths out when possible.
- **Avoid unnecessary fan-out**: Broadcast only on real shared-state changes, not on connect-only noise.
- **Bound hot paths**: Add explicit limits for room size / socket fan-out and keep per-message work predictable.
- **Shard for throughput**: A single DO is single-threaded and has soft throughput limits (~1k req/s for simple ops). Scale by creating more DO instances.

## Cloudflare DO References and Best Practices
- [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Create Durable Object Stubs and Send Requests](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/)
- [Access Durable Objects Storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [WebSockets in Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Development Workflow
- `pnpm dev` — local dev with Miniflare. **Managed by the user — do not run**, it may already be active.
- `pnpm build` — production build
- `pnpm run deploy` — build + `wrangler deploy`
- `pnpm typecheck` — type generation + TS check
- `pnpm test` — run Vitest suite (unit + component + DO integration tests)
- `pnpm test:workers` — run Durable Object integration tests only
- `pnpm test:ui` — run Vitest with UI (optional)

## Definition of Done (DOD)
- [ ] TypeScript compiles without errors (`pnpm typecheck`).
- [ ] Tests pass (`pnpm test`) — new logic/hooks/components have coverage.
- [ ] Projects builds (`pnpm build`).
- [ ] Edge cases handled: empty state, invalid input, reconnect, concurrent edits.
- [ ] No `any` types introduced.
- [ ] No deprecations in the checks!
- [ ] No console logs or debug output left in production code.
- [ ] Durable Object state remains consistent after every mutation (save then broadcast).
- [ ] New UI follows existing Tailwind patterns (no arbitrary values, no inline styles).
- [ ] If changing the WebSocket protocol, `app/lib/types.ts` is updated.
