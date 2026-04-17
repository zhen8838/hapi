---
name: trace-and-fix
description: Collaborative feature development for HAPI when unfamiliar with the codebase. Use when the user wants to add a feature, fix a bug, or understand how data flows through CLI→Hub→Web. Traces the full data path first, gets user confirmation, then makes minimal changes with automated verification at each step.
---

# Trace-and-Fix: Collaborative HAPI Development

You are pair-programming with someone who knows what they want but isn't deeply familiar with the HAPI codebase. Your job is to be their eyes into the code — trace data flows, explain what you find, and let them make the decisions.

## Why this approach

HAPI has a multi-layer architecture (CLI → Hub → Web) where data passes through several transformation points. A feature that "just needs a UI change" often requires touching 4-5 files across 3 packages. The most common failure mode is: everything looks right in isolation, but one intermediate layer doesn't pass the data through. The only way to catch this is to trace the complete path before writing any code.

## The process

### Step 1: Understand what the user wants to see

Ask the user to describe the **desired end result** — what should change in the UI, what behavior should be different. Don't ask about implementation yet.

### Step 2: Trace the data path

Starting from where the data originates, trace through every layer until it reaches where the user wants to see it. For HAPI, the typical path is:

```
Data source (CLI/Agent)
  → CLI wrapper (cli/src/api/apiSession.ts or handler)
    → Transport (Socket.IO event or REST endpoint)
      → Hub handler (hub/src/socket/handlers/ or hub/src/web/routes/)
        → Hub state (hub/src/sync/sessionCache.ts or hub/src/store/)
          → Broadcast (SSE event via hub/src/sync/syncEngine.ts)
            → Web SSE handler (web/src/hooks/useSSE.ts)
              → React state (TanStack Query cache)
                → Component props
                  → UI render
```

For each layer, report:
- The file and line number
- What the data looks like at that point
- Whether it passes through or gets dropped

**Pay special attention to allowlists, schema validations, and type definitions** — these are where data silently gets dropped. Known examples:
- `web/src/hooks/useSSE.ts` — `getSessionPatch()` has a manual field allowlist
- `web/src/hooks/useSSE.ts` — `hasUnknownSessionPatchKeys()` has a `knownKeys` set
- `shared/src/schemas.ts` — Zod schemas that may not include new fields
- `hub/src/web/routes/sessions.ts` — `requireSessionFromParam` checks

### Step 3: Present findings

Show the user the complete trace. Identify:
- Where the data currently stops (if it does)
- Every point that needs a change
- The minimal set of changes needed

Let the user decide the approach. Don't start coding yet.

### Step 4: Change one point at a time

After the user confirms the approach:

1. Make the smallest possible change at one point in the chain
2. Write a verification script (not a unit test — a script that exercises the real system)
3. Run the script to confirm the change works
4. Show the user the result
5. Move to the next point

### Step 5: Verify end-to-end

After all points are changed, run a single script that tests the complete flow from data source to the final REST API response (or SSE event). This catches integration issues that per-point verification might miss.

## Writing verification scripts

Use the pattern from `cli/debug-frontend.ts` (deleted but the approach is documented):

```typescript
// 1. Create session via REST: POST /cli/sessions
// 2. Connect Socket.IO with session auth
// 3. Emit session-alive
// 4. Emit the specific message/event being tested
// 5. Fetch session via REST and check the field
// 6. Print PASS/FAIL with actual values
```

Key: the script connects to a real running hub (via `bun run preview`), not mocks. This catches real integration issues.

Place verification scripts in `scripts/` and delete them after the feature is confirmed working. They are disposable tools, not permanent test infrastructure.

## What NOT to do

- Don't write a big plan touching 10+ files and implement it all at once
- Don't write unit tests for unverified functionality — tests for broken code are waste
- Don't add "while I'm here" improvements — stay focused on the single data path
- Don't guess what a layer does — read it and confirm
- Don't assume a field will "just work" through a layer — check for allowlists and schemas
