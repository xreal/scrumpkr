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

## Code Conventions
- **Strict TypeScript**: No `any`. Define interfaces in `app/lib/types.ts`.
- **Explicit naming**: `participantId`, not `id`. `roomData`, not `data`.
- **Immutability**: Prefer spreading over mutation. State updates in DO must be saved to storage explicitly.
- **Small components**: One file per component. Colocate hooks and helpers.
- **No magic numbers**: Extract constants (TTLs, limits) to top-level `const`.
- **Error handling**: Return actionable errors over WebSocket (`{ type: "error", error: "..." }`). Never swallow exceptions silently.

## State Management Rules
- **DO is the single source of truth**. Client is a thin projection.
- After every mutating action: update `roomData`, `saveToStorage()`, then `broadcastRoomState()`.
- Use `blockConcurrencyWhile` around read-modify-write in DO.
- Sanitize all user inputs at the boundary (`sanitizeName`, `sanitizeTitle`, `isValidVote`).

## WebSocket Protocol
- Client sends actions: `join`, `rejoin`, `set_name`, `set_mode`, `set_title`, `vote`, `reveal`, `reset_round`, `remove_participant`.
- Server broadcasts full `room_state` to all connected sockets after every change. No deltas in V1.
- Reconnect logic lives in `useWebSocket` (2s exponential backoff).

## File Organization
```
workers/app.ts          # Worker entry + Durable Object (backend)
app/routes/             # Page routes (React Router)
app/components/         # UI components (grouped by feature)
app/hooks/              # Reusable hooks
app/lib/                # Types, storage helpers, deck config
app/lib/__tests__/      # Unit tests for pure helpers (colocate or adjacent)
```

## Testing Philosophy
- **Test tool**: Vitest (native Vite integration, fast, modern).
- **New code should have tests**: Every new component, hook, or TypeScript utility *should* include at least one meaningful test.
- **Don't overtest**: Skip trivial tests (e.g., "button renders"). Focus on:
  - Business logic (vote validation, aggregation, sanitization)
  - State transitions (Durable Object actions)
  - User flows (join → vote → reveal)
  - Edge cases (reconnect, invalid input, empty state)
- **DO testing**: Use Miniflare's Durable Object testing utilities for integration tests against `PokerRoom`.
- **Keep tests close**: Colocate `*.test.ts` next to the file under test, or in `__tests__` within the same folder.

## Scaling Principles
- Stateless worker layer scales infinitely.
- Durable Objects isolate rooms — no cross-room queries.
- WebSocket hibernation keeps idle rooms near-zero cost.
- Keep DO storage small (< 1MB). History capped at 10 entries. Prune stale participants (30-day TTL).
- Avoid Cron. Avoid external APIs. Avoid heavy computation in DO.

## Development Workflow
- `pnpm dev` — local dev with Miniflare -> Never run this!
- `pnpm build` — production build
- `pnpm deploy` — build + `wrangler deploy`
- `pnpm typecheck` — type generation + TS check
- `pnpm test` — run Vitest suite (unit + component tests)
- `pnpm test:workers` — run Durable Object integration tests
- `pnpm test:ui` — run Vitest with UI (optional)

## Definition of Done (DOD)
- [ ] TypeScript compiles without errors (`pnpm typecheck`).
- [ ] Tests pass (`pnpm test`) — new logic/hooks/components have coverage.
- [ ] Projects builds (`pnpm build`).
- [ ] Edge cases handled: empty state, invalid input, reconnect, concurrent edits.
- [ ] No `any` types introduced.
- [ ] No console logs or debug output left in production code.
- [ ] Durable Object state remains consistent after every mutation (save then broadcast).
- [ ] New UI follows existing Tailwind patterns (no arbitrary values, no inline styles).
- [ ] If changing the WebSocket protocol, `app/lib/types.ts` is updated.
