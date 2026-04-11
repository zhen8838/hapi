# HAPI Frontend UX Improvements Design

## Overview

Six frontend improvements to enhance the HAPI web interface, inspired by Codex app design patterns. Changes span pure UI polish, new features, and a bug fix.

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
- Implementation: call `spawnSession()` with:
  - `resumeSessionId`: the source session ID
  - `additionalParameters`: `['--fork-session']`
- Return the new session ID
- Claude CLI executes: `claude --resume <id> --fork-session`
- Hook server receives new session's `SessionStart` event with a new session ID

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

### Integration: `web/src/components/AssistantChat/HappyComposer.tsx`

- Track previous sessionId via `useRef`
- On sessionId change (`useEffect`):
  1. Save current composer content to draft for the **old** sessionId
  2. Load draft for the **new** sessionId and restore to composer
- On successful message send: `clearDraft(sessionId)`

**Persistence**: `sessionStorage` (survives page refresh within tab, cleared on tab close — appropriate for drafts).

**Complexity**: Medium

## 6. Image Attachment Bug Fix

**Goal**: Fix the bug where selecting an image file via the attachment button produces no visible response.

**Symptom**: File picker opens, user selects an image, nothing happens (no upload, no preview, no error).

### Investigation Plan

- File: `web/src/lib/attachmentAdapter.ts`
- Debug the `add()` flow step by step:
  1. File type / MIME type filtering
  2. `FileReader.readAsDataURL` for base64 conversion (may fail silently on large images)
  3. `api.uploadFile()` call and error handling
  4. Attachment state transition: `uploading` -> `requires-action`

### Fix Strategy

- Identify the silent failure point and fix it
- Add proper error handling with toast notifications on failure
- Ensure uploaded images are stored in a path accessible to the agent process (e.g., `/tmp/hapi-uploads/`)
- Verify the image path is correctly passed as attachment metadata to the agent

**Complexity**: Medium

## Implementation Order

Recommended order by dependency and complexity:

1. **Copy Session ID** (low, standalone)
2. **Sidebar indentation** (low, standalone)
3. **Queue UI polish** (low, standalone)
4. **Per-session draft persistence** (medium, standalone)
5. **Image attachment bug fix** (medium, requires debugging)
6. **Fork session** (high, requires backend changes)

Items 1-3 are independent and can be parallelized.

## Files Affected

| File | Changes |
|------|---------|
| `web/src/components/SessionList.tsx` | Context menu (Copy ID, Fork), sidebar indentation |
| `web/src/components/AssistantChat/HappyComposer.tsx` | Queue UI, draft integration |
| `web/src/api/client.ts` | `forkSession()` method |
| `web/src/lib/draftStore.ts` | **New file** — draft persistence |
| `web/src/lib/attachmentAdapter.ts` | Image attachment bug fix |
| `hub/src/web/routes/sessions.ts` | Fork endpoint |
