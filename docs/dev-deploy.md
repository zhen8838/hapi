# Dev Deploy

This document describes how to run the current HAPI development branch in a way that matches the setup used in this repo during iterative UI and hub changes.

The goal is to run:

- a source-based dev hub (`hapi-hub-dev`)
- a source-based dev CLI (`hapi-dev`)
- the built web app from `web/dist`

This is useful when you want frontend changes to take effect after `bun run build:web` without rebuilding a single-file binary.

## 1. Clone the repo

```bash
git clone <your-fork-or-upstream-url>
cd hapi
git checkout <your-branch>
```

Example:

```bash
git clone https://github.com/zhen8838/hapi.git
cd hapi
git checkout feat/session-profiles-and-additional-params
```

## 2. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

If you want this permanently, add `~/.bun/bin` to your shell profile.

## 3. Install dependencies

From the repo root:

```bash
bun install --force --no-progress
```

## 4. Build the web app

```bash
bun run build:web
```

The hub will serve files directly from `web/dist` in source mode.

## 5. First hub startup and token generation

Run the hub once to generate `CLI_API_TOKEN` and initialize `~/.hapi/`:

```bash
export HAPI_LISTEN_HOST=0.0.0.0
export HAPI_LISTEN_PORT=3006
cd cli
bun src/index.ts hub
```

On first run, HAPI creates:

- `~/.hapi/settings.json`
- `~/.hapi/hapi.db`
- `~/.hapi/logs/`

The token is stored in `~/.hapi/settings.json` as `cliApiToken`.

## 6. Create dev wrappers in PATH

These wrappers let you explicitly use the source-based dev build without confusing it with any globally installed stable `hapi` binary.

### `hapi-dev`

```bash
cat > ~/.local/bin/hapi-dev <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
cd /path/to/hapi/cli
exec bun src/index.ts "$@"
EOF2
chmod +x ~/.local/bin/hapi-dev
```

### `hapi-hub-dev`

This defaults to port `3007` so it does not conflict with an existing stable hub.

```bash
cat > ~/.local/bin/hapi-hub-dev <<'EOF2'
#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
export HAPI_LISTEN_PORT="${HAPI_LISTEN_PORT:-3007}"
cd /path/to/hapi/cli
exec bun src/index.ts hub "$@"
EOF2
chmod +x ~/.local/bin/hapi-hub-dev
```

### Verify

```bash
command -v hapi-dev
command -v hapi-hub-dev
hapi-dev --help
```

## 7. Recommended pm2 deployment for the dev hub

If you want the dev hub to replace the currently used hub on port `3006`:

```bash
pm2 start "bash -lc 'export PATH=\"$HOME/.bun/bin:$PATH\"; export HAPI_HOME=$HOME/.hapi; export HAPI_LISTEN_HOST=0.0.0.0; export HAPI_LISTEN_PORT=3006; cd /path/to/hapi/cli && bun src/index.ts hub'" --name hapi-hub-dev
```

If you want it on a separate dev port:

```bash
pm2 start "bash -lc 'export PATH=\"$HOME/.bun/bin:$PATH\"; export HAPI_HOME=$HOME/.hapi; export HAPI_LISTEN_HOST=0.0.0.0; export HAPI_LISTEN_PORT=3007; cd /path/to/hapi/cli && bun src/index.ts hub'" --name hapi-hub-dev
```

### Logs

```bash
pm2 logs hapi-hub-dev
```

### Status

```bash
pm2 status
pm2 show hapi-hub-dev
```

## 8. Manual session startup in dev mode

Once the hub is running, start sessions with the dev wrapper:

```bash
hapi-dev
hapi-dev codex
hapi-dev claude --plugin-dir /path/to/plugin
```

Use `hapi-dev` instead of a globally installed `hapi` when you want CLI behavior to match the current branch code.

## 9. Mobile / remote access

### Local network / Tailscale

If the hub listens on `0.0.0.0`, open:

```text
http://<machine-ip>:3006
```

or if using a separate dev port:

```text
http://<machine-ip>:3007
```

Login with the `CLI_API_TOKEN` from `~/.hapi/settings.json`.

## 10. When frontend changes take effect

If you change files under `web/src/**`, run:

```bash
cd /path/to/hapi
bun run build:web
```

Then refresh the browser.

In source mode, the hub serves static assets from `web/dist`, so rebuilding the web app is usually enough.

## 11. When to restart the hub

Restart the hub when you change:

- `hub/src/**`
- auth or settings behavior
- port / host environment variables
- anything that affects backend runtime behavior

Example:

```bash
pm2 restart hapi-hub-dev
```

## 12. Useful commands

### Rebuild frontend only

```bash
cd /path/to/hapi
bun run build:web
```

### Restart dev hub

```bash
pm2 restart hapi-hub-dev
```

### Stop dev hub

```bash
pm2 stop hapi-hub-dev
```

### Remove dev hub from pm2

```bash
pm2 delete hapi-hub-dev
```

### Start a second hub manually on another port

```bash
HAPI_LISTEN_PORT=3010 hapi-hub-dev
```

## 13. Notes

- `bun.lock` is a dependency lock file. It does not need to change for normal UI-only changes.
- If you are iterating on the frontend, this source-based deployment is usually much faster than rebuilding the all-in-one executable.
- If you want a cleaner production setup later, switch back to the packaged/global `hapi` or a compiled binary.
