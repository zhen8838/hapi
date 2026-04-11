# Merge Upstream Main into hapi-feat-frontend-improve-v2

**Date:** 2026-04-11
**Branch:** `hapi-feat-frontend-improve-v2`
**Upstream:** `origin/main` (14 commits ahead of merge base `56925f8`)

## Goal

Bring the feature branch up to date with upstream main so that our frontend improvements (queue messages, fork session, composer UX, sidebar resize) incorporate upstream bugfixes and new features.

## Approach

Direct `git merge origin/main` — a single merge commit. Chosen over rebase (too many commits to replay) and cherry-pick (upstream commits have interdependencies).

## Upstream Commits Being Merged

| Commit | Summary |
|--------|---------|
| `3b92268` | fix(web): restore conditional TTL guard on visibility refresh (#443) |
| `813ac7f` | feat(web): add LaTeX math formula rendering with KaTeX (#436) |
| `9a48d5a` | fix(hub,web): extend JWT expiration and harden visibility refresh (#442) |
| `73e3d6e` | fix typecheck |
| `03b6a66` | fix(security): potential command injection on windows (#439) |
| `92d3685` | fix(hub): allow terminal re-registration after socket reconnect (#434) |
| `f04a6fa` | fix(web): use explicit Manager+socket for terminal namespace connection (#433) |
| `30f8b12` | fix(web): allow multiline input with modifier+Enter in composer (#431) |
| `c62a1eb` | fix(cli,hub): resolve typecheck errors in codex reasoning effort (#432) |
| `ef87e30` | feat(web): redesign sidebar with resizable width and 3-level hierarchy (#427) |
| `79a13d2` | Fix Codex reasoning effort resume and updates |
| `0e1b653` | feat: display background task count in status bar (#421) |
| `2eae161` | fix: filter rate_limit_event from Claude Remote/Local chat paths (#423) |
| `f1daed8` | fix: composer keyboard behavior and allow sending while agent is running (#422) |

## Auto-Merged Files (No Conflicts)

7 files modified on both branches will auto-merge (verified by dry-run):

- `hub/src/sync/rpcGateway.ts`
- `hub/src/sync/syncEngine.ts`
- `hub/src/web/routes/sessions.ts`
- `web/src/api/client.ts`
- `web/src/lib/locales/en.ts`
- `web/src/lib/locales/zh-CN.ts`
- `web/src/components/SessionChat.tsx`

Plus all upstream-only files (no conflict possible).

## Conflict Resolution Plan

### 1. `web/src/components/AssistantChat/HappyComposer.tsx`

**Our changes:** Queue message system (canQueue, enqueueCurrentComposer, queued message cards UI, PaperclipIcon/QueueXIcon), initialText/onTextChange props, removed voice props from ComposerButtons, removed `max-w-content`.

**Upstream changes:** Codex reasoning effort settings (modelReasoningEffort + overlay UI), backgroundTaskCount prop, Enter key behavior refactor (Shift+Enter = newline, plain Enter = send), suggestion selection on Enter, `canSend` no longer checks `!threadIsRunning`.

**Conflict zones:**
1. **Import section** — trivial, keep both additions
2. **Props definition** — trivial, keep both additions
3. **`canSend` definition** — **design decision required**: upstream removed `!threadIsRunning` from canSend (allowing send while running). Our queue feature depends on the distinction between canSend (not running) and canQueue (running). **Resolution: keep our `!threadIsRunning` check on canSend** to preserve queue semantics. Final expression:
   ```ts
   const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && !threadIsRunning
   const canQueue = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && threadIsRunning
   ```
4. **Keyboard handler** — main conflict area. Final if-else order:
   ```
   1. Shift+Enter → return (let textarea insert newline, from upstream)
   2. Enter + suggestions visible → select suggestion (from upstream)
   3. Ctrl/Cmd+Enter → send if canSend, queue if canQueue (from ours)
   4. Plain Enter (no modifiers) → send if canSend, queue if canQueue (merged)
   ```
   The Ctrl/Cmd+Enter check (step 3) must come BEFORE the plain Enter check (step 4) to avoid being swallowed. The Shift+Enter early return (step 1) must come first to prevent send/queue on Shift+Enter.
5. **Settings overlay** — no conflict, upstream adds reasoning effort section in a different area than our queue UI
6. **Voice props removal** — our change, upstream doesn't touch this. Keep our removal.
7. **`submitOnEnter={false}`** — both sides made the same change. No conflict.

### 2. `web/src/components/SessionList.tsx`

**Our changes:** Added `onCopyId` (clipboard copy of session ID) and `onFork` (fork session via API) props to SessionActionMenu, plus `useNavigate` and `useToast` imports, minor border styling tweak.

**Upstream changes:** Complete structural redesign — 3-level hierarchy (Machine -> Project -> Session), new types (`MachineGroup`), new components (`FlavorIcon`, `CopyPathButton`, `LoaderIcon`), new grouping function (`groupByMachine`), removed `getSessionModelLabel`/`getAgentLabel`, rewrote session list JSX.

**Resolution:** Take upstream's redesign as the base (it's a structural rewrite, not a patch). Then re-apply our additions:
- Add `useNavigate` and `useToast` imports to the file
- Upstream preserves the `SessionItem` component name and its `<SessionActionMenu>` child — confirmed by reading the upstream diff
- Add `onCopyId` and `onFork` handler props to `SessionItem`'s `<SessionActionMenu>` call (same prop interface as before)
- Add `forkVisible` prop to `<SessionActionMenu>` (gated on `s.metadata?.flavor === 'claude'`)
- The `onCopyId` and `onFork` callbacks are self-contained — they only touch the menu props, not the list structure

Our border styling tweak (`pl-5` on the session group div) is superseded by upstream's complete layout rewrite and can be dropped.

### 3. `web/src/router.tsx`

**Our changes:** Inline sidebar resize implementation (useState, useRef, mouse events, localStorage persistence, media query for lg breakpoint).

**Upstream changes:** Same sidebar resize feature extracted into `useSidebarResize` hook, uses pointer events, CSS variable `--sidebar-w`.

**Resolution:** Take upstream's version entirely. Our inline implementation is functionally equivalent but upstream's is cleaner:
- Hook extraction (`useSidebarResize`) follows project patterns
- Pointer events have better cross-device support than mouse events
- CSS variable approach is more flexible than inline style

Discard all our inline resize code (the useState, useRef, useEffect, handleDragStart, isLgScreen state).

## Verification Steps

After resolving conflicts:

1. `npx tsc --noEmit` — typecheck passes
2. `npm run build` (or equivalent) — build succeeds
3. Enter-key behavior regression:
   - Shift+Enter inserts newline (not send)
   - Plain Enter sends message when idle
   - Plain Enter queues message when agent is running
   - Ctrl/Cmd+Enter sends or queues (same logic as plain Enter)
   - Enter with suggestions visible selects the suggestion
4. Manual smoke test: queue message feature works, fork session works, sidebar resize works, new upstream features (LaTeX, 3-level sidebar, background task count) render correctly

## Rollback

If merge produces unexpected issues: `git reset --hard HEAD~1` returns to pre-merge state (single merge commit to undo).
