# CLAUDE.md

## What is HAPI?

Local-first platform for running AI coding agents (Claude Code, Codex, Gemini) with remote control via web/phone. CLI wraps agents and connects to hub; hub serves web app and handles real-time sync.

## Repo layout

Bun monorepo with workspaces:

```
cli/     - CLI binary, agent wrappers, runner daemon
hub/     - Hono HTTP API + Socket.IO + SSE + Telegram bot (Bun runtime)
web/     - React 19 PWA (Vite + TanStack Router/Query + Tailwind + assistant-ui)
shared/  - Common types, Zod schemas, utilities
docs/    - VitePress documentation site
website/ - Marketing site
```

## Quick start

```bash
bun install              # Install all dependencies
bun run dev              # Hub (3006) + Web dev server (5173) concurrently
bun run preview          # Build web + hub, serve on a random free port
```

## Build commands

```bash
bun run build            # Build cli + hub + web
bun run build:web        # Web only (Vite → web/dist)
bun run build:hub        # Hub only (Bun bundler → hub/dist)
bun run build:cli        # CLI only
bun run build:single-exe # All-in-one binary with embedded web assets
```

## Test commands

```bash
bun run test             # All packages (Vitest)
bun run test:cli         # CLI tests only
bun run test:hub         # Hub tests only
bun run test:web         # Web tests only
bun run typecheck        # TypeScript check all packages
```

## Preview / manual testing

```bash
bun run preview                        # Auto-find free port
HAPI_LISTEN_PORT=5000 bun run preview  # Specific port
```

Builds web + hub, then starts hub serving both API and static frontend on one port. Hub auto-discovers `web/dist`.

## Code conventions

- TypeScript strict; no untyped code
- 4-space indentation
- Path alias `@/*` → `./src/*` per package
- Zod for runtime validation (`shared/src/schemas.ts`)
- No backward compatibility: break old formats freely
- Pragmatism over overengineering
- Write necessary tests ONLY
- Test files: `*.test.ts` next to source

## Architecture

```
CLI ──Socket.IO──→ Hub ──SSE/REST──→ Web (PWA)
```

1. CLI spawns agent, connects to hub via Socket.IO
2. Agent events → CLI → hub → DB + SSE broadcast
3. Web subscribes to SSE `/api/events`, receives live updates
4. User actions → Web → hub REST API → RPC to CLI → agent

## Key environment variables

- `HAPI_LISTEN_PORT` — Hub HTTP port (default: 3006)
- `HAPI_LISTEN_HOST` — Hub bind host (default: 127.0.0.1)
- `CLI_API_TOKEN` — Auth token for CLI↔Hub
- `VITE_HUB_PROXY` — Web dev server API proxy target (default: http://127.0.0.1:3006)

## Reference docs

- `AGENTS.md` — AI agent guide: architecture, source dirs, common tasks
- `CONTRIBUTING.md` — PR guidelines, code policy
- `web/README.md` — Routes, components, features, auth, data fetching
- `docs/guide/` — User guides (installation, how-it-works, FAQ)
