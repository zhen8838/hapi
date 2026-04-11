# HAPI Frontend UX Improvements Design

## Overview

Nine frontend/backend improvements to enhance the HAPI web interface, inspired by Codex app design patterns. Changes span UI polish, new features, infrastructure, and a bug fix.

## 1. Copy Session ID (Context Menu)

**Goal**: Allow users to copy a session ID for manual resume operations.

**Changes**:
- File: `web/src/components/SessionList.tsx`
- Add "Copy Session ID" option to the existing session right-click/long-press context menu
- Position: top of the menu, before Rename
- On click: `navigator.clipboard.writeText(session.id)` + toast "Copied to clipboard"
- Icon: clipboard/copy icon

**Complexity**: Low

## 2. Fork Session (Claude Only)

**Goal**: Allow users to fork a session, creating an independent branch of the conversation with full agent context preserved.

**Approach**: Leverage Claude CLI's native `--fork-session` flag with `--resume`.

### Frontend

- File: `web/src/components/SessionList.tsx`
- Add "Fork Session" option to context menu
- Only visible when session's agent flavor is `claude`
- Only enabled when session is inactive (active sessions must stop first)
- On click: call `api.forkSession(sessionId)`, show loading toast, navigate to new session on success

- File: `web/src/api/client.ts`
- Add method: `forkSession(sessionId: string): Promise<string>`
- Calls `POST /api/sessions/:id/fork`

### Backend

- File: `hub/src/web/routes/sessions.ts`
- New endpoint: `POST /api/sessions/:id/fork`
- Response: `{ sessionId: string }`

- File: `hub/src/sync/syncEngine.ts`
- New method: `forkSession(sessionId, namespace)` — mirrors `resumeSession()` logic:
  1. Look up source session metadata (path, machineId, flavor, model, effort)
  2. Validate flavor is `claude`, else return error
  3. Resolve target machine (by machineId or hostname match, same as resume)
  4. If target machine is offline, return error
  5. Call `spawnSession()` with:
     - `directory`: source session's path
     - `resumeSessionId`: source session ID
     - `additionalParameters`: `['--fork-session']`
  6. Call `waitForSessionActive()` to block until the new session is ready
  7. Return the new session ID
- Claude CLI executes: `claude --resume <id> --fork-session`
- Hook server receives new session's `SessionStart` event with a new session ID

### Navigation

- Frontend navigates to `/sessions/${newSessionId}` only after the fork API returns successfully (backend already waited for session to be active)

### Limitations

- Only works for Claude agent sessions. Other agents (Codex, Gemini, Cursor) do not support this.
- Source session must be inactive.

**Complexity**: High

## 3. Sidebar Indentation

**Goal**: Improve visual hierarchy between folder groups and session items.

**Changes**:
- File: `web/src/components/SessionList.tsx`
- Session items container: add `padding-left: 20px` for clear indentation under group headers
- Session items container: add `border-left: 1px solid var(--app-border)` vertical connector line
- Group headers: no changes (already have `border-l-[3px]` accent and background color)

**Visual result**:
```
> my-project (3)                     <- group header
|   * Session about auth refactor    <- indented + vertical line
|   * Fix login bug
|   o Old discussion
> another-project (1)
|   * New feature planning
```

**Complexity**: Low

## 4. Queue UI Polish

**Goal**: Improve the visual quality of queued message cards above the composer.

**Changes**:
- File: `web/src/components/AssistantChat/HappyComposer.tsx` (lines ~745-775)

**Before**: Transparent background, plain border, text-based "Queue Item N" label, text "Remove" button.

**After**:
- Background: `bg-[var(--app-subtle-bg)]` for layer contrast
- Left accent bar: `border-l-[3px] border-l-[var(--app-link)]` (Codex-style)
- Sequence badge: circular numbered badge (`1`, `2`...) on the left, replacing "Queue Item N" text
- Message preview: `max-h-20 overflow-hidden` with gradient fade for long messages
- Attachment indicator: icon + count instead of text
- Delete button: `X` icon in top-right corner, replacing text "Remove"

**Card layout**:
```
+-- +--------------------------------------+
| 1 | Fix the login timeout issue...       | X
|   | [paperclip] 2                        |
+-- +--------------------------------------+
```

**Complexity**: Low

## 5. Per-Session Draft Persistence

**Goal**: Preserve composer input text and attachments when switching between sessions.

### New File: `web/src/lib/draftStore.ts` (~40 lines)

```typescript
interface Draft {
  text: string
  attachments: AttachmentMetadata[]
}

// In-memory Map<sessionId, Draft> backed by sessionStorage for refresh survival
saveDraft(sessionId: string, draft: Draft): void
loadDraft(sessionId: string): Draft | null
clearDraft(sessionId: string): void
```

### Integration: `web/src/components/SessionChat.tsx` (NOT HappyComposer)

**Key constraint**: `HappyComposer` is keyed by `session.id` (`key={props.session.id}`), so it re-mounts on every session switch. Draft save/restore logic must live in the parent `SessionChat` component where `sessionId` is stable across switches.

- `SessionChat` tracks previous sessionId via `useRef`
- On sessionId change (`useEffect`):
  1. Save current composer text (read via `api.composer().getText()` or a callback ref) to draft for the **old** sessionId
  2. Pass loaded draft for the **new** sessionId as `initialText` prop to `HappyComposer`
- `HappyComposer`: accept optional `initialText` prop, call `api.composer().setText()` on mount if provided
- On successful message send: `clearDraft(sessionId)` (called from `SessionChat`)

**Persistence**: `sessionStorage` (survives page refresh within tab, cleared on tab close — appropriate for drafts).

**Complexity**: Medium

## 6. Image Attachment Bug Fix

**Goal**: Fix the bug where selecting an image file via the attachment button produces no visible response.

**Symptom**: File picker opens, user selects an image, nothing happens (no upload, no preview, no error).

### Investigation Plan (ordered by likelihood)

1. **File input handler** (`web/src/components/AssistantChat/ComposerButtons.tsx`):
   - Verify the `<input type="file">` onChange handler calls `api.composer().addAttachment(file)`
   - Check if `accept` attribute or other filtering rejects images
2. **Async generator consumption** (`@assistant-ui/react` integration):
   - Verify `@assistant-ui/react`'s `ComposerPrimitive.Attachments` correctly handles the async generator pattern from `attachmentAdapter.add()`
3. **Attachment adapter** (`web/src/lib/attachmentAdapter.ts`):
   - The adapter itself has error handling (size check, FileReader catch, upload error check), so it's less likely to be the culprit. Check only if steps 1-2 are clean.

### Fix Strategy

- Identify the silent failure point and fix it
- Add proper error handling with toast notifications on failure
- Ensure uploaded images are stored in a path accessible to the agent process (e.g., `/tmp/hapi-uploads/`)
- Verify the image path is correctly passed as attachment metadata to the agent

**Complexity**: Medium

## 7. Profile File Persistence + Behavior Fix

**Goal**: Migrate profiles from browser localStorage to file-based persistence at `~/.hapi/profiles/`, add missing config fields, and fix default selection behavior.

### Backend

- File: `hub/src/web/routes/` (new route file or extend existing)
- New API endpoints:
  - `GET /api/profiles` — read all `.json` files from `~/.hapi/profiles/`, return array
  - `PUT /api/profiles/:id` — create or update `~/.hapi/profiles/{id}.json`
  - `DELETE /api/profiles/:id` — delete profile file
- Create `~/.hapi/profiles/` directory on first write if it doesn't exist

### Profile Schema Update

Add two new fields to `SessionProfileConfig`:
```typescript
type SessionProfileConfig = {
    agent: AgentType
    model: string
    effort: ClaudeEffort
    modelReasoningEffort: CodexReasoningEffort
    yoloMode: boolean
    sessionType: SessionType
    worktreeName: string
    additionalParameters: string[]
    permissionMode: string          // NEW
    collaborationMode: string       // NEW
}
```

### Frontend

- File: `web/src/components/NewSession/preferences.ts`
  - Remove ALL localStorage persistence: `hapi:newSession:profiles`, `hapi:newSession:selectedProfileId`, `hapi:newSession:agent`, `hapi:newSession:yolo`
  - No fallback memory — opening New Session page always starts with hardcoded defaults (agent=claude, yolo=false, model=auto, effort=auto, etc.)

- File: `web/src/hooks/queries/` (new hook)
  - New `useProfiles()` hook using react-query to fetch/mutate profiles via API

- File: `web/src/components/NewSession/index.tsx`
  - Replace localStorage calls with `useProfiles()` hook
  - **Default behavior**: on page open, no profile is selected, all fields at defaults
  - **On profile select**: `applyProfile()` fills all fields including new permissionMode/collaborationMode
  - Update `saveProfile()` / `updateProfile()` to call PUT API
  - Update `deleteProfile()` to call DELETE API

- File: `web/src/components/NewSession/ProfileSection.tsx`
  - Add permissionMode and collaborationMode to the profile save/display logic

**Complexity**: High

## 8. Scroll-to-Bottom Button

**Goal**: Show a persistent down-arrow button whenever the chat scroll position is not at the bottom.

### Changes

- File: `web/src/components/AssistantChat/HappyThread.tsx`
- Replace or augment the existing `NewMessagesIndicator` (which only shows on pending messages):
  - New circular button with down-arrow icon
  - Visible whenever `autoScrollEnabled === false` (i.e., user has scrolled up more than 120px from bottom)
  - Positioned at bottom-center of the thread viewport
  - On click: `scrollToBottom()` (existing function)
  - If there are also pending messages, show a count badge on the button
- **Z-index / overlap with queue**: The button is positioned within the thread viewport (which ends above the composer area). Queue cards are rendered inside the composer area below the thread. No overlap possible since they are in different containers.
- Style: circular, semi-transparent background, subtle shadow, similar to ChatGPT/Codex scroll button

**Complexity**: Low

## 9. Resizable Sidebar + Remove Chat Max-Width

**Goal**: Allow users to drag the sidebar edge to resize it, and remove the 720px content width cap so chat content fills available space.

### Sidebar Resize

- File: `web/src/router.tsx` (SessionsPage layout)
- Replace fixed `lg:w-[420px] xl:w-[480px]` with a dynamic width controlled by state
- Add a drag handle (invisible 4-6px wide area) on the sidebar's right edge
- On mousedown: start tracking mouse movement, update sidebar width
- Constraints:
  - Sidebar minimum width: 280px
  - Chat area minimum width: 400px (calculated as `viewport - sidebarWidth`)
  - When either minimum is reached, stop resizing
- Persist sidebar width in `localStorage` so it survives page refresh
- On mobile (< lg breakpoint): no change, sidebar still full-width toggle

### Remove Chat Max-Width

- File: `web/tailwind.config.ts`
  - Remove the `maxWidth: { content: '720px' }` custom theme extension
- All elements using `max-w-content` class will now have no max-width constraint
- Chat messages, headers, and other content will fill the available chat area width — no upper limit, user controls width via sidebar drag
- Add reasonable horizontal padding (already exists as `px-3`) to prevent text hitting edges

**Complexity**: Medium

## Implementation Order

Recommended order by dependency and complexity:

1. **Copy Session ID** (low, standalone)
2. **Sidebar indentation** (low, standalone)
3. **Queue UI polish** (low, standalone)
4. **Scroll-to-bottom button** (low, standalone)
5. **Remove chat max-width** (low, standalone — part of #9)
6. **Per-session draft persistence** (medium, standalone)
7. **Resizable sidebar** (medium, standalone — part of #9)
8. **Image attachment bug fix** (medium, requires debugging)
9. **Profile file persistence** (high, requires backend)
10. **Fork session** (high, requires backend)

Items 1-4 are independent and can be parallelized.

## Files Affected

| File | Changes |
|------|---------|
| `web/src/components/SessionList.tsx` | Context menu (Copy ID, Fork), sidebar indentation |
| `web/src/components/SessionActionMenu.tsx` | New menu items: Copy ID, Fork (new props: `onCopyId`, `onFork`, `forkEnabled`) |
| `web/src/components/SessionChat.tsx` | Draft save/restore orchestration, pass `initialText` to composer |
| `web/src/components/AssistantChat/HappyComposer.tsx` | Queue UI, accept `initialText` prop |
| `web/src/components/AssistantChat/HappyThread.tsx` | Scroll-to-bottom button |
| `web/src/components/AssistantChat/ComposerButtons.tsx` | Image attachment bug investigation |
| `web/src/components/NewSession/index.tsx` | Profile API integration, default behavior fix |
| `web/src/components/NewSession/preferences.ts` | Remove localStorage profile persistence, update schema |
| `web/src/components/NewSession/ProfileSection.tsx` | New profile fields UI |
| `web/src/router.tsx` | Resizable sidebar layout |
| `web/tailwind.config.ts` | Remove `max-w-content: 720px` |
| `web/src/api/client.ts` | `forkSession()` method, profile API methods |
| `web/src/hooks/queries/useProfiles.ts` | **New file** — react-query hook for profiles |
| `web/src/lib/draftStore.ts` | **New file** — draft persistence |
| `web/src/lib/attachmentAdapter.ts` | Image attachment bug fix (if needed) |
| `hub/src/web/routes/sessions.ts` | Fork endpoint |
| `hub/src/web/routes/profiles.ts` | **New file** — Profile CRUD endpoints |
| `hub/src/sync/syncEngine.ts` | `forkSession()` method |
