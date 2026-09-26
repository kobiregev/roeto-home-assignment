# Dice Game

A two-player dice game. Express + TypeScript API, React + Vite frontend.

## Run it

```bash
npm install        # installs root, server and web (postinstall)
npm run dev        # API on :3001, web on :5173 (Vite proxies /api to the API)
npm test           # server and web tests
npm run typecheck
```

Open http://localhost:5173. The page has two independent player windows; log each one in as a different user.

Seeded users (there is no registration):

| Username | Password   |
| -------- | ---------- |
| alice    | alice123   |
| bob      | bob123     |
| carol    | carol123   |

`JWT_SECRET` and `PORT` can be set through the environment. Without `JWT_SECRET` a development secret is used and a warning is logged.

## Rules as implemented

- Each turn, the current player rolls two dice. The sum is added to the **round score**.
- **Hold** banks the round score into the player's total and passes the turn.
- Rolling **6 and 6** loses the round score and passes the turn.
- The first player whose banked total reaches the winning score wins (default 100, configurable 10–1000 per game).

## Structure

```
server/src/game      pure rules (no I/O, no clock, injected dice roller)
server/src/services  orchestration: load, apply engine, save; per-game lock
server/src/store     async Store interface + in-memory implementation
server/src/routes    thin REST handlers (Zod validation, central error handler)
web/src              React UI; each window owns its own session, the server owns all state
```

The rules live in one pure module so they can be tested without HTTP or a database. The store is an async interface, so a file or SQL store is a drop-in replacement.

## Assumptions

- **Win is checked on Hold**, as in classic Pig, not on Roll.
- **Holding with a round score of 0 is rejected** (409). Roll first.
- **The game starts only when two different users are in it.** A game is created as `waiting`; a second, different user joining is the "ready" signal. Joining your own game, a third user joining, or rolling/holding while waiting all return 409. This stops one user playing against themselves, which is possible when both windows share one browser.
- **The server enforces turns.** The JWT user must be the current player, otherwise 403, regardless of what the UI shows.
- **Leaving:** either player can cancel a waiting game or quit an active one (no winner). Creating or joining a game abandons your other unfinished games.
- **Ended games remain visible until each player acknowledges them** (`POST /games/:id/acknowledge`), so a result screen does not reappear after logout or reload.
- **No live updates.** Both windows live in one React page, so any action in either window triggers a refetch in both. No polling and no websockets.
- **In-memory storage.** Games and win counts are lost when the API restarts. Tokens issued before a restart are rejected, because they are checked against the store.
- **Users are seeded**, passwords hashed with `bcryptjs` (pure JS, so no native build on Windows).
- The win counter per user is included; other extras (AI opponent, sound) were left out on purpose to stay near the 2-hour budget.

## What I'd do differently with more time

- **Persistence:** a real database behind the existing `Store` interface, so games and win counts survive restarts.
- **Concurrency:** the per-game lock is a single-process promise queue. With more than one instance it needs a DB transaction or optimistic version check. Abandoning a user's other games inside create/join is not locked at all.
- **Live updates:** server-sent events or websockets, so two real browsers see each other's moves. Today it only works because both windows share one page.
- **REST shape:** replace `/games/open` and `/games/current` with one list endpoint with filters (`GET /games?status=&mine=`).
- **Auth:** registration, refresh tokens, a required `JWT_SECRET`, rate limiting on login.
- **Code style:** the engine and services are plain functions; a class-based version, and controllers instead of router factories, were considered and deferred as not critical.
- **Testing:** browser-level (Playwright) test of a full two-window game; the current tests cover the engine, store, service (including a double-click race), API and components.

## AI usage

I built this with Claude Code. The conversation is in [docs/AI_CONVERSATION.md](docs/AI_CONVERSATION.md): what I asked for, the plans I reviewed and pushed back on, and how each part was verified, including a bug I found in manual testing and how we fixed it. Tool calls are summarised in one line each, and raw tool output is left out.
