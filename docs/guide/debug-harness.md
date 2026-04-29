# Debug Harness

Use this harness when you want Codex with Computer Use to drive HAPI end to end and leave a trace that is easy to inspect after each action.

## What it captures

The preview harness starts a hub and runner with one shared `HAPI_HOME`.

- `preview.log` captures combined preview process output.
- `logs/*-hub.log` captures hub startup, config, tunnel, ready, shutdown, and fatal errors.
- `logs/*-runner.log` captures runner lifecycle and spawned session events.
- `logs/*.log` captures CLI/agent session logs.

`bun run preview` enables `HAPI_LOG_LEVEL=debug` by default. `DEBUG=1` still works for older flows.

## Run the harness

```bash
bun install
bun run harness-debug
```

For a persistent trace directory:

```bash
HAPI_HOME=/tmp/hapi-trace bun run preview
```

For repeatable browser automation, keep the preview port and token stable:

```bash
HAPI_HOME=/tmp/hapi-trace \
HAPI_LISTEN_PORT=50533 \
CLI_API_TOKEN=hapi-debug-token \
bun run harness-debug
```

The command prints the local URL, token, combined preview log, and HAPI log directory. Keep the process running while Computer Use drives the browser.
When the debugging task is done, leave the preview server running so the user can inspect the final state.

## Computer Use loop

1. Start `bun run preview`.
2. Open the printed local URL with Computer Use.
3. Log in with the printed token.
4. Start or resume a Codex session from the UI.
5. Use Computer Use to perform the workflow being tested.
6. After each meaningful action, inspect the newest logs:

```bash
ls -lt "$HAPI_HOME"/logs
tail -n 200 "$HAPI_HOME"/preview.log
tail -n 200 "$HAPI_HOME"/logs/*-hub.log
tail -n 200 "$HAPI_HOME"/logs/*-runner.log
tail -n 200 "$HAPI_HOME"/logs/*.log
```

If `HAPI_HOME` was not set, use the `HAPI_HOME` path printed by `bun run preview`.

## Replay fixtures

Use `scripts/replay-jsonl.ts` when you want a repeatable frontend state without driving a live agent. It injects saved Claude Code JSONL or Hub fixture JSON into a Hub session, then opens the data through the normal Hub/Web paths.

Start the preview harness first:

```bash
HAPI_HOME=/tmp/hapi-trace \
HAPI_LISTEN_PORT=50533 \
CLI_API_TOKEN=hapi-debug-token \
bun run preview
```

Then replay a prepared fixture against the same port and `HAPI_HOME`:

```bash
HAPI_HOME=/tmp/hapi-trace \
bun run scripts/replay-jsonl.ts scripts/fixtures/background-tasks-taoke-test.jsonl --port 50533
```

For background task UI testing, add synthetic agent and shell tasks:

```bash
HAPI_HOME=/tmp/hapi-trace \
bun run scripts/replay-jsonl.ts scripts/fixtures/background-tasks-taoke-test.jsonl --port 50533 --bg-tasks 4
```

Useful prepared inputs:

- `scripts/fixtures/background-tasks-taoke-test.jsonl` replays a long Claude Code session with todo items, background agents, and background shell output.
- `scripts/fixtures/skill-inline-leak.json` replays a compact Hub fixture for skill rendering checks.
- `scripts/replay-jsonl.ts` has built-in sample background task prompts and shell commands under `sampleTasks`.

The replay script uses `settings.json` from `HAPI_HOME` to read the CLI token and writes into that same `hapi.db`. Keep the preview server running after replay so the user can inspect the generated session in the browser.

## Trace-and-fix command

Use `.claude/commands/trace-and-fix.md` as the companion workflow when the fix spans CLI, Hub, and Web. It is the saved Claude command for collaborative HAPI debugging.

The command's core rules:

1. Ask for the desired end result before choosing an implementation.
2. Trace the full data path from the source through CLI, transport, Hub, persistence/cache, SSE/API, Web state, and final UI.
3. Report where the data is passed through or dropped, with file and line references.
4. Change one point at a time after the approach is confirmed.
5. Use disposable verification scripts for real Hub runs, then delete those scripts after the feature is confirmed.

The command specifically calls out common drop points:

- `web/src/hooks/useSSE.ts` manual session patch allowlists.
- `shared/src/schemas.ts` and other Zod schemas.
- Hub route validation and access checks.
- Type definitions along the CLI → Hub → Web path.

For this debug harness, use `trace-and-fix` to decide what to inspect and change, `bun run preview` to run the real system, and `scripts/replay-jsonl.ts` when a saved transcript can reproduce the frontend state faster than a live agent.

## Remote log sink

For a simple AI-debugging sink, set:

```bash
HAPI_LOG_REMOTE_URL=http://127.0.0.1:3006
HAPI_LOG_LEVEL=debug
```

CLI logs will post to `/logs-combined-from-cli-and-mobile-for-simple-ai-debugging`. Use this only on trusted local/dev networks; it is intentionally not a production telemetry pipeline.

## Trace checklist

- The preview process printed `HAPI logs`.
- The preview URL uses the expected fixed port.
- The printed token matches the expected fixed `CLI_API_TOKEN`.
- A `*-hub.log` exists after the hub starts.
- A `*-runner.log` exists after the runner starts.
- A session log exists after Codex or another agent starts.
- UI actions line up with hub, runner, and session timestamps.
- The failing action has a nearby log entry before and after it.

## Debugging playbook

Use this flow when a browser action fails and you need Codex to fix it:

1. Keep `bun run preview` running with a stable `HAPI_HOME`.
2. Reproduce the issue in the browser.
3. Capture the URL, selected UI text, and exact user action.
4. Read logs from newest to oldest:

```bash
ls -lt "$HAPI_HOME"/logs
tail -n 200 "$HAPI_HOME"/preview.log
tail -n 200 "$HAPI_HOME"/logs/*-hub.log
tail -n 200 "$HAPI_HOME"/logs/*-runner.log
tail -n 200 "$HAPI_HOME"/logs/*.log
```

5. Match the browser timestamp to:
   - HTTP/API request in `preview.log`
   - hub lifecycle/API behavior in `*-hub.log`
   - spawn/RPC behavior in `*-runner.log`
   - agent/runtime behavior in the session log
6. Fix the earliest missing or wrong data hop.
7. Run `bun run typecheck` and `bun run test`.
8. Restart `bun run preview`, then reproduce again.

### Example: Claude env routing

Problem: Claude Code sessions launched from HAPI could not use a local Claude-dir routing setup for a DPSK model.

Observed browser symptom:

```text
API Error: 400 InvalidSubscription
```

Trace result:

- `preview.log` showed a normal `/api/machines/:id/spawn` request.
- `*-runner.log` showed the spawn payload had `directory`, `agent`, `model`, `effort`, `yolo`, `sessionType`, and `additionalParameters`, but no environment variables.
- The runner spawned `hapi claude ...` with only inherited runner env and internal HAPI env.
- The Claude session log then showed the provider subscription error, meaning the expected local routing env never reached Claude Code.

Fix shape:

- Add `environmentVariables: Record<string, string>` to the spawn request path.
- Parse `KEY=value` lines in the New Session UI.
- Save environment variables in session profiles.
- Validate env keys at the hub API boundary.
- Pass env through hub RPC to the runner.
- Merge env into the spawned child process.
- Redact env values in runner debug logs.

Expected verification:

- New Session UI shows an Environment Variables field.
- `*-runner.log` shows `environmentVariables` keys with `[redacted]` values.
- The spawned session no longer fails because local routing env is missing.
