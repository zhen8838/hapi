# HAPI Frontend UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 frontend UX improvements: context menu actions (Copy ID, Fork), sidebar indentation, queue UI polish, scroll-to-bottom button, draft persistence, image attachment fix, profile file persistence, and resizable sidebar with uncapped chat width.

**Architecture:** Changes span the React frontend (`web/src/`) and Node.js backend (`hub/src/`). Most tasks are pure frontend (Tailwind + React state). Two tasks require new backend endpoints (profiles CRUD, session fork). The attachment fix requires debugging an existing flow.

**Tech Stack:** React 19, Vite, TanStack Router, TanStack React Query, @assistant-ui/react, Tailwind CSS v4, Hono (backend), TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-11-frontend-ux-improvements-design.md`

---

## Chunk 1: Low-Complexity UI Changes

### Task 1: Copy Session ID — Context Menu

**Files:**
- Modify: `web/src/components/SessionActionMenu.tsx`
- Modify: `web/src/components/SessionList.tsx`
- Modify: `web/src/lib/locales/en.ts`

- [ ] **Step 1: Add translation key**

In `web/src/lib/locales/en.ts`, find the `session.action` keys and add:

```typescript
'session.action.copyId': 'Copy Session ID',
'session.action.copyIdDone': 'Copied to clipboard',
```

- [ ] **Step 2: Add `onCopyId` prop and menu item to `SessionActionMenu.tsx`**

In `web/src/components/SessionActionMenu.tsx`, add `onCopyId?: () => void` to the props type (around line 12-21). Then add a new menu item **before** the Rename button (around line 232):

```tsx
{props.onCopyId ? (
    <button
        type="button"
        role="menuitem"
        className={`${baseItemClassName} hover:bg-[var(--app-subtle-bg)]`}
        onClick={() => { props.onCopyId?.(); props.onClose(); }}
    >
        <ClipboardIcon className="text-[var(--app-hint)]" />
        {t('session.action.copyId')}
    </button>
) : null}
```

**Icons**: This codebase uses inline SVG functions (no icon library). Define `ClipboardIcon` as an inline SVG in `SessionActionMenu.tsx`, following the same pattern as `EditIcon`/`ArchiveIcon`/`TrashIcon` already in that file:

```tsx
function ClipboardIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
    )
}
```

- [ ] **Step 3: Wire up `onCopyId` in `SessionList.tsx`**

In `web/src/components/SessionList.tsx`, find where `<SessionActionMenu>` is rendered (around line 309-317). First, add the toast hook import and usage. The toast API uses `useToast()` from `@/lib/toast-context`, and the `addToast` function requires `{ title, body, sessionId, url }`:

```typescript
import { useToast } from '@/lib/toast-context'
// Inside SessionItem component:
const { addToast } = useToast()
```

Then add the `onCopyId` prop:

```tsx
<SessionActionMenu
    isOpen={menuOpen}
    onClose={() => setMenuOpen(false)}
    sessionActive={s.active}
    onCopyId={() => {
        navigator.clipboard.writeText(s.id)
        addToast({ title: t('session.action.copyIdDone'), body: s.id, sessionId: s.id, url: '' })
    }}
    onRename={() => setRenameOpen(true)}
    onArchive={() => setArchiveOpen(true)}
    onDelete={() => setDeleteOpen(true)}
    anchorPoint={menuAnchorPoint}
/>
```

- [ ] **Step 4: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SessionActionMenu.tsx web/src/components/SessionList.tsx web/src/lib/locales/en.ts
git commit -m "feat: add Copy Session ID to session context menu"
```

---

### Task 2: Sidebar Indentation

**Files:**
- Modify: `web/src/components/SessionList.tsx`

- [ ] **Step 1: Add indentation and vertical line to session items container**

In `web/src/components/SessionList.tsx`, find the session items container rendered under each group header (around lines 448-498). The current container wrapping session items when not collapsed looks like:

The container likely already has `border-l border-l-[var(--app-divider)]`. Update it to:
1. Add `pl-5` (20px padding-left, matching spec's "padding-left: 20px")
2. Change `border-l-[var(--app-divider)]` to `border-l-[var(--app-border)]` for a visible connector line

Before (example — verify exact existing classes):
```tsx
<div className="flex flex-col divide-y divide-[var(--app-divider)] border-b border-[var(--app-divider)] border-l border-l-[var(--app-divider)]">
```

After:
```tsx
<div className="flex flex-col divide-y divide-[var(--app-divider)] border-b border-[var(--app-divider)] pl-5 border-l border-l-[var(--app-border)]">
```

The `pl-5` (20px) creates clear indentation from the group header. The `border-l-[var(--app-border)]` makes the vertical connector line visible (more contrast than `--app-divider`).

- [ ] **Step 2: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SessionList.tsx
git commit -m "feat: add sidebar indentation for session items under folder groups"
```

---

### Task 3: Queue UI Polish

**Files:**
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/lib/locales/en.ts`

- [ ] **Step 1: Replace queue card rendering**

In `web/src/components/AssistantChat/HappyComposer.tsx`, find the queue rendering block (around lines 745-775). Replace the entire `queuedMessages.map(...)` block with:

```tsx
{queuedMessages.length > 0 ? (
    <div className="mb-2 flex flex-col gap-2">
        {queuedMessages.map((message, index) => (
            <div
                key={message.id}
                className="relative flex items-start gap-3 rounded-xl border-l-[3px] border-l-[var(--app-link)] bg-[var(--app-subtle-bg)] px-3 py-2.5 text-sm"
            >
                {/* Sequence badge */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--app-link)] text-[10px] font-bold text-white">
                    {index + 1}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="max-h-20 overflow-hidden whitespace-pre-wrap break-words text-[13px] leading-snug text-[var(--app-fg)]" style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}>
                        {message.text.trim() || t('composer.queueAttachmentOnly')}
                    </div>
                    {message.attachments && message.attachments.length > 0 ? (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--app-hint)]">
                            <PaperclipIcon className="h-3 w-3" />
                            <span>{message.attachments.length}</span>
                        </div>
                    ) : null}
                </div>

                {/* Delete button */}
                <button
                    type="button"
                    onClick={() => removeQueuedMessage(message.id)}
                    className="shrink-0 rounded p-0.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                    aria-label={t('composer.queueRemove')}
                >
                    <XIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        ))}
    </div>
) : null}
```

**Icons**: This codebase uses inline SVG functions (no icon library). Define `PaperclipIcon` and `XIcon` at the top of `HappyComposer.tsx`:

```tsx
function PaperclipIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    )
}

function XIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
    )
}
```

Note: The gradient fade on the message preview uses CSS `mask-image` to create a smooth fadeout when text overflows `max-h-20` (80px).

- [ ] **Step 2: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssistantChat/HappyComposer.tsx
git commit -m "feat: polish queue message card UI with accent bar and badges"
```

---

### Task 4: Scroll-to-Bottom Button

**Files:**
- Modify: `web/src/components/AssistantChat/HappyThread.tsx`
- Modify: `web/src/lib/locales/en.ts`

- [ ] **Step 1: Add translation key**

In `web/src/lib/locales/en.ts`, add:

```typescript
'misc.scrollToBottom': 'Scroll to bottom',
```

- [ ] **Step 2: Replace `NewMessagesIndicator` with `ScrollToBottomButton`**

In `web/src/components/AssistantChat/HappyThread.tsx`, replace the `NewMessagesIndicator` component (lines 14-28) with:

```tsx
function ScrollToBottomButton(props: {
    visible: boolean
    pendingCount: number
    onClick: () => void
}) {
    const { t } = useTranslation()
    if (!props.visible) {
        return null
    }
    return (
        <button
            onClick={props.onClick}
            aria-label={t('misc.scrollToBottom')}
            className="absolute bottom-6 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)] shadow-md ring-1 ring-[var(--app-border)] transition-all hover:bg-[var(--app-subtle-bg)] animate-bounce-in"
        >
            <ChevronDownIcon className="h-4 w-4" />
            {props.pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--app-link)] px-1 text-[10px] font-bold text-white">
                    {props.pendingCount}
                </span>
            ) : null}
        </button>
    )
}
```

**Icons**: Define `ChevronDownIcon` as an inline SVG in `HappyThread.tsx` (same pattern as other files in this codebase — no icon library):

```tsx
function ChevronDownIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
```

- [ ] **Step 3: Update usage site**

Find where `NewMessagesIndicator` is used in the component (search for `<NewMessagesIndicator` in the same file). Replace:

```tsx
<NewMessagesIndicator count={pendingCount} onClick={scrollToBottom} />
```

with:

```tsx
<ScrollToBottomButton
    visible={!autoScrollEnabled}
    pendingCount={pendingCount}
    onClick={scrollToBottom}
/>
```

The key change: the old indicator only showed when `pendingCount > 0`. The new button shows whenever `autoScrollEnabled === false` (user scrolled up), regardless of pending messages.

- [ ] **Step 4: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AssistantChat/HappyThread.tsx web/src/lib/locales/en.ts
git commit -m "feat: add persistent scroll-to-bottom button in chat thread"
```

---

## Chunk 2: Medium-Complexity Changes

### Task 5: Remove Chat Max-Width (Scoped)

**Files:**
- Modify: `web/src/components/AssistantChat/HappyThread.tsx`
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/SessionHeader.tsx`
- Modify: `web/src/router.tsx`

- [ ] **Step 1: Remove `max-w-content` from HappyThread**

In `web/src/components/AssistantChat/HappyThread.tsx`, find the message container div that has `max-w-content` (look for `className="mx-auto w-full max-w-content` inside the viewport). Remove `max-w-content` from that className. Keep `mx-auto w-full` and padding.

Also check if there are multiple `max-w-content` usages in this file — remove from all chat-content-related ones.

- [ ] **Step 2: Remove `max-w-content` from HappyComposer**

In `web/src/components/AssistantChat/HappyComposer.tsx`, search for `max-w-content` and remove it from all className strings. The composer container should fill available width.

- [ ] **Step 3: Remove `max-w-content` from SessionHeader**

In `web/src/components/SessionHeader.tsx`, find line 111 with `className="mx-auto w-full max-w-content flex items-center gap-2 p-3"`. Remove `max-w-content`:

```tsx
className="mx-auto w-full flex items-center gap-2 p-3"
```

- [ ] **Step 4: Check router.tsx for chat-area `max-w-content` usage**

In `web/src/router.tsx`, search for `max-w-content`. All usages (lines 137, 164) are in the **sidebar** panel, not the chat area. The chat area only contains `<Outlet />`. **Do not modify router.tsx** — there is nothing to remove here. Remove `web/src/router.tsx` from the commit in Step 6 as well.

- [ ] **Step 5: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds. Chat content area should now fill available width.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AssistantChat/HappyThread.tsx web/src/components/AssistantChat/HappyComposer.tsx web/src/components/SessionHeader.tsx
git commit -m "feat: remove max-w-content cap from chat area components"
```

---

### Task 6: Per-Session Draft Persistence

**Files:**
- Create: `web/src/lib/draftStore.ts`
- Modify: `web/src/components/SessionChat.tsx`
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`

- [ ] **Step 1: Create `draftStore.ts`**

Create `web/src/lib/draftStore.ts`:

```typescript
import type { AttachmentMetadata } from '@/types/api'

interface Draft {
    text: string
    attachments: AttachmentMetadata[]
}

const STORAGE_PREFIX = 'hapi:draft:'
const drafts = new Map<string, Draft>()

// Load from sessionStorage on init
try {
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
            const sessionId = key.slice(STORAGE_PREFIX.length)
            const data = JSON.parse(sessionStorage.getItem(key) ?? '')
            drafts.set(sessionId, data)
        }
    }
} catch { /* ignore corrupt storage */ }

export function saveDraft(sessionId: string, draft: Draft): void {
    if (!draft.text && draft.attachments.length === 0) {
        clearDraft(sessionId)
        return
    }
    drafts.set(sessionId, draft)
    try {
        sessionStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(draft))
    } catch { /* storage full, in-memory still works */ }
}

export function loadDraft(sessionId: string): Draft | null {
    return drafts.get(sessionId) ?? null
}

export function clearDraft(sessionId: string): void {
    drafts.delete(sessionId)
    try {
        sessionStorage.removeItem(STORAGE_PREFIX + sessionId)
    } catch { /* ignore */ }
}
```

- [ ] **Step 2: Add `initialText` and `onTextChange` props to HappyComposer (do this BEFORE Step 3)**

In `web/src/components/AssistantChat/HappyComposer.tsx`, add to the props interface (around line 44-72):
```typescript
initialText?: string
onTextChange?: (text: string) => void
```

Add a `useEffect` that sets the composer text on mount when `initialText` is provided (place after `useAssistantApi()` call):

```typescript
useEffect(() => {
    if (props.initialText) {
        api.composer().setText(props.initialText)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Add a `useEffect` that reports text changes to the parent:

```typescript
useEffect(() => {
    props.onTextChange?.(composerText)
}, [composerText, props.onTextChange])
```

- [ ] **Step 3: Integrate draft save/restore in SessionChat.tsx**

In `web/src/components/SessionChat.tsx`:

1. Import draft functions:
```typescript
import { saveDraft, loadDraft, clearDraft } from '@/lib/draftStore'
```

2. Add a ref for draft tracking (note: `prevSessionIdRef` already exists in `SessionChat.tsx` ~line 164 for cache clearing — use a different name):
```typescript
const draftPrevSessionIdRef = useRef<string | null>(null)
const composerTextRef = useRef<string>('')
```

3. Add a callback for the composer to report its text (so SessionChat can read it on session switch):
```typescript
const handleComposerTextChange = useCallback((text: string) => {
    composerTextRef.current = text
}, [])
```

4. Add a `useEffect` to save draft when session changes (note: attachments are saved as `[]` — a known simplification since reading current attachment state from the `@assistant-ui/react` runtime is non-trivial):
```typescript
useEffect(() => {
    const prevId = draftPrevSessionIdRef.current
    draftPrevSessionIdRef.current = props.session.id

    if (prevId && prevId !== props.session.id) {
        saveDraft(prevId, { text: composerTextRef.current, attachments: [] })
    }
}, [props.session.id])
```

5. Compute `initialText` for the composer:
```typescript
const draft = loadDraft(props.session.id)
const initialText = draft?.text ?? ''
```

6. Pass props to HappyComposer:
```tsx
<HappyComposer
    initialText={initialText}
    onTextChange={handleComposerTextChange}
    ...existing props...
/>
```

7. In the send handler, clear the draft:
```typescript
// After successful send
clearDraft(props.session.id)
```

- [ ] **Step 4: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/draftStore.ts web/src/components/SessionChat.tsx web/src/components/AssistantChat/HappyComposer.tsx
git commit -m "feat: persist composer draft text per session across switches"
```

---

### Task 7: Resizable Sidebar

**Files:**
- Modify: `web/src/router.tsx`

- [ ] **Step 1: Add sidebar width state and localStorage persistence**

In `web/src/router.tsx`, first update the React import to include `useState`, `useRef`, and `useEffect` (the file currently only imports `useCallback` and `useMemo`). Then inside the `SessionsPage` component (around line 104), add state for sidebar width:

```typescript
const SIDEBAR_MIN = 280
const CHAT_MIN = 400
const SIDEBAR_STORAGE_KEY = 'hapi:sidebar:width'
const DEFAULT_SIDEBAR_WIDTH = 420

const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
        if (stored) return Math.max(SIDEBAR_MIN, parseInt(stored, 10))
    } catch {}
    return DEFAULT_SIDEBAR_WIDTH
})

const isDraggingRef = useRef(false)
```

- [ ] **Step 2: Add drag handlers**

Add mouse event handlers for the drag handle:

```typescript
const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleDragMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return
        const maxWidth = window.innerWidth - CHAT_MIN
        const clamped = Math.max(SIDEBAR_MIN, Math.min(e.clientX, maxWidth))
        setSidebarWidth(clamped)
    }

    const handleDragEnd = () => {
        isDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
        // Persist
        setSidebarWidth((w) => {
            try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w)) } catch {}
            return w
        })
    }

    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
}, [])
```

- [ ] **Step 3: Update sidebar container to use dynamic width**

Find the sidebar `<div>` (around line 133) that has `lg:w-[420px] xl:w-[480px]`. Replace the fixed width classes with dynamic inline style:

Before:
```tsx
<div className={`${isSessionsIndex ? 'flex' : 'hidden lg:flex'} w-full lg:w-[420px] xl:w-[480px] shrink-0 flex-col bg-[var(--app-bg)] lg:border-r lg:border-[var(--app-divider)]`}>
```

After (remove `lg:w-[420px] xl:w-[480px]`, apply width via inline style on desktop only):
```tsx
<div
    className={`${isSessionsIndex ? 'flex' : 'hidden lg:flex'} w-full shrink-0 flex-col bg-[var(--app-bg)] lg:border-r lg:border-[var(--app-divider)]`}
    style={isLgScreen ? { width: sidebarWidth, maxWidth: sidebarWidth } : undefined}
>
```

You'll need to detect the `lg` breakpoint. Add a simple media query hook or use `window.matchMedia`:

```typescript
const [isLgScreen, setIsLgScreen] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsLgScreen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
}, [])
```

On desktop, apply the width via inline style. On mobile, let `w-full` take effect.

- [ ] **Step 4: Add the drag handle element**

Between the sidebar `<div>` and the chat area `<div>`, add the drag handle:

```tsx
{/* Drag handle - only on desktop */}
{isLgScreen ? (
    <div
        onMouseDown={handleDragStart}
        className="hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-[var(--app-link)]/20 transition-colors shrink-0"
    />
) : null}
```

This creates a 4px wide invisible handle that highlights on hover.

- [ ] **Step 5: Build and verify**

```bash
cd web && npm run build
```

Expected: Build succeeds. Sidebar should be draggable on desktop.

- [ ] **Step 6: Commit**

```bash
git add web/src/router.tsx
git commit -m "feat: add resizable sidebar with drag handle and width persistence"
```

---

## Chunk 3: High-Complexity Changes + Bug Fix

### Task 8: Image Attachment Bug Fix

**Files:**
- Modify: `web/src/components/AssistantChat/ComposerButtons.tsx` (likely)
- Modify: `web/src/lib/attachmentAdapter.ts` (possibly)

This task requires debugging. The steps below are an investigation guide, not a fixed recipe.

- [ ] **Step 1: Check the runtime configuration (most likely culprit)**

In `web/src/lib/assistant-runtime.ts`, check how the attachment adapter is registered with the assistant runtime. If `adapters.attachments` is not set or misconfigured, the `add()` generator is never called at all. Add `console.log('attachmentAdapter.add called')` at the top of the `add()` generator in `attachmentAdapter.ts` to confirm whether it's reached.

- [ ] **Step 2: Check the attachment adapter integration**

In `web/src/lib/attachmentAdapter.ts`, the `add()` method (around line 29) is an async generator. The adapter itself already has error handling (size check at line 47-57, FileReader catch at lines 109-118, upload error check at lines 81-91), so errors inside are unlikely to be silent. Check:

1. Is the async generator being properly consumed (iterated) by `@assistant-ui/react`?
2. Check if the `accept: '*/*'` at line 27 is actually reaching the file input element.

- [ ] **Step 3: Check `ComposerButtons.tsx` file input handler**

In `web/src/components/AssistantChat/ComposerButtons.tsx`, the attachment button (around line 244-251) uses `ComposerPrimitive.AddAttachment` from `@assistant-ui/react`. This is a primitive component that handles the file picker internally. Verify:

1. Add `console.log` on file selection to see if the `onChange` event fires.
2. Check if the file reaches `api.composer().addAttachment(file)` or an equivalent call.

- [ ] **Step 4: Implement the fix**

Based on findings from steps 1-3, implement the fix. Common fixes:

- If the file input `accept` attribute is too restrictive, change to `accept="*/*"` or add image MIME types.
- If the async generator isn't being consumed, check `@assistant-ui/react` version compatibility.
- If the upload succeeds but the state isn't updated, check the `yield` statements in the generator return the correct `AttachmentStatus`.
- Ensure uploaded files are stored where the agent can access them. If the backend stores files in a path the agent can't read, update the upload handler to use `/tmp/hapi-uploads/` or another accessible directory.

- [ ] **Step 5: Add error visibility**

Regardless of the root cause, add a `console.error` or toast notification in the `add()` generator's catch blocks so future failures are visible:

```typescript
} catch (error) {
    console.error('Attachment upload failed:', error)
    // Show toast if available
}
```

- [ ] **Step 6: Build and verify**

```bash
cd web && npm run build
```

- [ ] **Step 7: Commit**

```bash
# List the specific files you modified during debugging — do NOT use git add -A
git add web/src/lib/attachmentAdapter.ts web/src/lib/assistant-runtime.ts web/src/components/AssistantChat/ComposerButtons.tsx
git commit -m "fix: resolve image attachment selection not triggering upload"
```

---

### Task 9: Profile File Persistence + Behavior Fix

**Files:**
- Create: `hub/src/web/routes/profiles.ts`
- Modify: `hub/src/web/server.ts` (route registration)
- Modify: `web/src/components/NewSession/preferences.ts`
- Create: `web/src/hooks/queries/useProfiles.ts`
- Modify: `web/src/components/NewSession/index.tsx`
- Modify: `web/src/components/NewSession/ProfileSection.tsx`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Create backend profile routes**

Create `hub/src/web/routes/profiles.ts`. Follow the pattern from `hub/src/web/routes/sessions.ts` for route structure (Hono app, middleware, etc.):

```typescript
import { Hono } from 'hono'
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const PROFILES_DIR = join(homedir(), '.hapi', 'profiles')

async function ensureDir() {
    await mkdir(PROFILES_DIR, { recursive: true })
}

const app = new Hono()

// GET /api/profiles — list all profiles
app.get('/profiles', async (c) => {
    try {
        await ensureDir()
        const files = await readdir(PROFILES_DIR)
        const profiles = []
        for (const file of files) {
            if (!file.endsWith('.json')) continue
            try {
                const content = await readFile(join(PROFILES_DIR, file), 'utf-8')
                profiles.push(JSON.parse(content))
            } catch { /* skip corrupt files */ }
        }
        return c.json(profiles)
    } catch (error) {
        return c.json({ error: 'Failed to read profiles' }, 500)
    }
})

// PUT /api/profiles/:id — create or update a profile
app.put('/profiles/:id', async (c) => {
    try {
        await ensureDir()
        const id = c.req.param('id')
        // Sanitize ID to prevent path traversal
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return c.json({ error: 'Invalid profile ID' }, 400)
        }
        const body = await c.req.json()
        body.id = id
        await writeFile(join(PROFILES_DIR, `${id}.json`), JSON.stringify(body, null, 2), 'utf-8')
        return c.json({ success: true })
    } catch (error) {
        return c.json({ error: 'Failed to save profile' }, 500)
    }
})

// DELETE /api/profiles/:id — delete a profile
app.delete('/profiles/:id', async (c) => {
    try {
        const id = c.req.param('id')
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return c.json({ error: 'Invalid profile ID' }, 400)
        }
        await unlink(join(PROFILES_DIR, `${id}.json`))
        return c.json({ success: true })
    } catch (error) {
        return c.json({ error: 'Failed to delete profile' }, 500)
    }
})

export { createProfileRoutes }
```

- [ ] **Step 2: Register the profile routes**

Routes are registered in `hub/src/web/server.ts`. Session routes are mounted via `app.route('/api', createSessionsRoutes(options.getSyncEngine))` (around line 93). Add a similar line for profiles:

```typescript
import { createProfileRoutes } from './routes/profiles'
// Add near the session routes registration:
app.route('/api', createProfileRoutes())
```

Update the profile routes file to export a factory function matching this pattern:
```typescript
export function createProfileRoutes() {
    const app = new Hono()
    // ... all the route definitions ...
    return app
}
```

- [ ] **Step 3: Add profile API methods to `client.ts`**

In `web/src/api/client.ts`, add methods following the existing `resumeSession` pattern:

```typescript
async getProfiles(): Promise<SessionProfile[]> {
    return this.request<SessionProfile[]>('/api/profiles')
}

async saveProfile(profile: SessionProfile): Promise<void> {
    await this.request(`/api/profiles/${encodeURIComponent(profile.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
    })
}

async deleteProfile(profileId: string): Promise<void> {
    await this.request(`/api/profiles/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
    })
}
```

Import `SessionProfile` type from wherever `preferences.ts` exports it (may need to move the type to a shared location).

- [ ] **Step 4: Update `SessionProfileConfig` type in `preferences.ts`**

In `web/src/components/NewSession/preferences.ts`, add the two new fields to `SessionProfileConfig`:

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
    permissionMode: PermissionMode    // agent-scoped, uses protocol union type
    collaborationMode: CodexCollaborationMode // only applies when agent === 'codex'
}
```

Update the `normalizeSessionProfileConfig` function to include defaults for the new fields:

```typescript
permissionMode: config.permissionMode ?? 'default',
collaborationMode: config.collaborationMode ?? 'default',
```

- [ ] **Step 5: Create `useProfiles` hook**

Create `web/src/hooks/queries/useProfiles.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { SessionProfile } from '@/components/NewSession/preferences'

// Follows the same pattern as useSessions.ts: receives api as parameter
export function useProfiles(api: ApiClient | null) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['profiles'],
        queryFn: async () => {
            if (!api) throw new Error('API unavailable')
            return await api.getProfiles()
        },
        enabled: Boolean(api),
    })

    const saveMutation = useMutation({
        mutationFn: (profile: SessionProfile) => api!.saveProfile(profile),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    })

    const deleteMutation = useMutation({
        mutationFn: (profileId: string) => api!.deleteProfile(profileId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    })

    return {
        profiles: query.data ?? [],
        isLoading: query.isLoading,
        saveProfile: saveMutation.mutateAsync,
        deleteProfile: deleteMutation.mutateAsync,
        isSaving: saveMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}
```

- [ ] **Step 6: Add localStorage migration**

In `web/src/components/NewSession/index.tsx`, add a one-time migration effect. The `api` client is available via the `useProfiles` hook's `saveProfile` mutation, or get `api` from props/context (check how the `NewSession` component receives the API client — it's likely passed as a prop or accessed via `useAppContext()`):

```typescript
useEffect(() => {
    const migrateProfiles = async () => {
        const KEY = 'hapi:newSession:profiles'
        const raw = localStorage.getItem(KEY)
        if (!raw) return

        try {
            const oldProfiles: SessionProfile[] = JSON.parse(raw)
            for (const profile of oldProfiles) {
                await saveProfile(profile)  // from useProfiles() hook
            }
            // Clear all old keys
            localStorage.removeItem(KEY)
            localStorage.removeItem('hapi:newSession:selectedProfileId')
            localStorage.removeItem('hapi:newSession:agent')
            localStorage.removeItem('hapi:newSession:yolo')
        } catch {
            // Backend unreachable — keep localStorage, retry next load
        }
    }
    migrateProfiles()
}, [saveProfile])
```

- [ ] **Step 7: Replace localStorage profile operations with API calls**

In `web/src/components/NewSession/index.tsx`:

1. Replace `useState` for profiles with `useProfiles()` hook:
```typescript
const { profiles, saveProfile, deleteProfile: deleteProfileApi } = useProfiles()
```

2. Remove the `useEffect` that loads profiles from localStorage.

3. Update `handleSaveProfileAsNew` to call the API:
```typescript
const handleSaveProfileAsNew = useCallback(async () => {
    const trimmedName = profileName.trim()
    if (!trimmedName) return
    const now = Date.now()
    const profile: SessionProfile = {
        id: makeClientSideId('profile'),
        name: trimmedName,
        config: currentProfileConfig(),
        createdAt: now,
        updatedAt: now,
    }
    await saveProfile(profile)
    setSelectedProfileId(profile.id)
    setProfileName(trimmedName)
}, [currentProfileConfig, profileName, saveProfile])
```

4. Update `handleUpdateProfile` similarly — call `saveProfile(updatedProfile)` instead of `setProfiles(...)`.

5. Update `handleDeleteProfile` — call `deleteProfileApi(id)` instead of `setProfiles(...)`.

6. Update `currentProfileConfig()` to include the new fields:
```typescript
const currentProfileConfig = useCallback((): SessionProfileConfig => ({
    ...existing fields...,
    permissionMode: permissionMode ?? 'default',
    collaborationMode: collaborationMode ?? 'default',
}), [...deps...])
```

- [ ] **Step 8: Fix default behavior — no profile selected on open**

In `web/src/components/NewSession/index.tsx`:

1. Change the initial `selectedProfileId` state to `null` (not loaded from localStorage):
```typescript
const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
```

2. Remove any `useEffect` that reads `loadSelectedSessionProfileId()`.

3. Remove calls to `saveSelectedSessionProfileId()`.

4. Remove `loadPreferredAgent()` / `savePreferredAgent()` usage — set defaults hardcoded:
```typescript
const [agent, setAgent] = useState<AgentType>('claude')
const [yoloMode, setYoloMode] = useState(false)
```

- [ ] **Step 9: Update `applyProfile` to include new fields**

```typescript
const applyProfile = useCallback((profile: SessionProfile | null) => {
    if (!profile) return
    skipAgentDefaultsRef.current = true
    setAgent(profile.config.agent)
    setModel(profile.config.model)
    setEffort(profile.config.effort)
    setModelReasoningEffort(profile.config.modelReasoningEffort)
    setYoloMode(profile.config.yoloMode)
    setSessionType(profile.config.sessionType)
    setWorktreeName(profile.config.worktreeName)
    setAdditionalParameters([...profile.config.additionalParameters])
    // New fields
    if (profile.config.permissionMode) {
        setPermissionMode(profile.config.permissionMode)
    }
    if (profile.config.agent === 'codex' && profile.config.collaborationMode) {
        setCollaborationMode(profile.config.collaborationMode)
    }
    setProfileName(profile.name)
}, [])
```

Check that `setPermissionMode` and `setCollaborationMode` state setters exist in the NewSession component. If these fields are not currently managed in NewSession, add the state and wire them into the session creation payload.

- [ ] **Step 10: Build and verify**

```bash
cd web && npm run build
# Also build the hub
cd ../hub && npm run build
```

Expected: Both builds succeed.

- [ ] **Step 11: Commit**

```bash
git add hub/src/web/routes/profiles.ts hub/src/web/server.ts web/src/hooks/queries/useProfiles.ts web/src/api/client.ts web/src/components/NewSession/preferences.ts web/src/components/NewSession/index.tsx web/src/components/NewSession/ProfileSection.tsx
git commit -m "feat: migrate profiles to file-based persistence at ~/.hapi/profiles/"
```

---

### Task 10: Fork Session (Claude Only)

**Files:**
- Modify: `hub/src/sync/syncEngine.ts`
- Modify: `hub/src/web/routes/sessions.ts`
- Modify: `web/src/api/client.ts`
- Modify: `web/src/components/SessionActionMenu.tsx`
- Modify: `web/src/components/SessionList.tsx`
- Modify: `web/src/lib/locales/en.ts`

- [ ] **Step 1: Add `forkSession` method to `syncEngine.ts`**

In `hub/src/sync/syncEngine.ts`, add a new method modeled after `resumeSession()` (around line 346). The key difference is passing `additionalParameters: ['--fork-session']`:

```typescript
async forkSession(sessionId: string, namespace: string): Promise<ResumeSessionResult> {
    const access = this.sessionCache.resolveSessionAccess(sessionId, namespace)
    if (!access.ok) {
        return {
            type: 'error',
            message: access.reason === 'access-denied' ? 'Session access denied' : 'Session not found',
            code: access.reason === 'access-denied' ? 'access_denied' : 'session_not_found',
        }
    }

    const session = access.session
    const metadata = session.metadata ?? {}

    // Validate session is inactive (active sessions cannot be forked)
    if (session.active) {
        return {
            type: 'error',
            message: 'Cannot fork an active session — stop it first',
            code: 'session_active',
        }
    }

    // Validate flavor is claude
    const flavor = metadata.flavor ?? 'claude'
    if (flavor !== 'claude') {
        return {
            type: 'error',
            message: 'Fork is only supported for Claude sessions',
            code: 'unsupported_agent',
        }
    }

    // Extract resume token (same as resumeSession)
    const resumeToken = metadata.claudeSessionId

    // Find online machine (same logic as resumeSession)
    const onlineMachines = this.machineCache.getOnlineMachinesByNamespace(namespace)
    const targetMachine = (() => {
        if (metadata.machineId) {
            const exact = onlineMachines.find((m) => m.id === metadata.machineId)
            if (exact) return exact
        }
        if (metadata.host) {
            const hostMatch = onlineMachines.find((m) => m.metadata?.host === metadata.host)
            if (hostMatch) return hostMatch
        }
        return null
    })()

    if (!targetMachine) {
        return { type: 'error', message: 'No machine online for this session', code: 'no_machine_online' }
    }

    // Spawn with --fork-session flag
    // rpcGateway.spawnSession signature (from hub/src/sync/rpcGateway.ts):
    //   (machineId, directory, agent, model, modelReasoningEffort, yolo,
    //    sessionType, worktreeName, resumeSessionId, effort, additionalParameters)
    // Note: additionalParameters is the LAST (11th) argument, resumeSessionId is 9th
    const spawnResult = await this.rpcGateway.spawnSession(
        targetMachine.id,
        metadata.path,
        flavor,                             // agent
        session.model ?? undefined,         // model
        undefined,                          // modelReasoningEffort
        undefined,                          // yolo
        undefined,                          // sessionType
        undefined,                          // worktreeName
        resumeToken,                        // resumeSessionId (9th)
        session.effort ?? undefined,        // effort (10th)
        ['--fork-session'],                 // additionalParameters (11th)
    )

    // Wait for new session to become active
    const becameActive = await this.waitForSessionActive(spawnResult.sessionId)
    if (!becameActive) {
        return { type: 'error', message: 'Forked session did not become active', code: 'timeout' }
    }

    // NOTE: Unlike resumeSession, do NOT call mergeSessions() here.
    // Fork intentionally creates a new independent session — we want separate IDs.
    return { type: 'success', sessionId: spawnResult.sessionId }
}
```

- [ ] **Step 2: Add fork endpoint to `sessions.ts`**

In `hub/src/web/routes/sessions.ts`, add the fork endpoint after the resume endpoint (around line 116):

```typescript
app.post('/sessions/:id/fork', async (c) => {
    const engine = requireSyncEngine(c, getSyncEngine)
    if (engine instanceof Response) return engine

    const sessionResult = requireSessionFromParam(c, engine)
    if (sessionResult instanceof Response) return sessionResult

    const namespace = c.get('namespace')
    const result = await engine.forkSession(sessionResult.sessionId, namespace)
    if (result.type === 'error') {
        const status = result.code === 'no_machine_online' ? 503
            : result.code === 'access_denied' ? 403
            : result.code === 'session_not_found' ? 404
            : result.code === 'unsupported_agent' ? 400
            : 500
        return c.json({ error: result.message, code: result.code }, status)
    }

    return c.json({ type: 'success', sessionId: result.sessionId })
})
```

- [ ] **Step 3: Add `forkSession` to API client**

In `web/src/api/client.ts`, add:

```typescript
async forkSession(sessionId: string): Promise<string> {
    const response = await this.request<{ sessionId: string }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/fork`,
        { method: 'POST' }
    )
    return response.sessionId
}
```

- [ ] **Step 4: Add translation keys**

In `web/src/lib/locales/en.ts`, add:

```typescript
'session.action.fork': 'Fork Session',
'session.action.forking': 'Forking session...',
'session.action.forkSuccess': 'Session forked',
'session.action.forkError': 'Failed to fork session',
```

- [ ] **Step 5: Add `onFork` prop to `SessionActionMenu.tsx`**

In `web/src/components/SessionActionMenu.tsx`, add to props:

```typescript
onFork?: () => void
forkVisible?: boolean  // only show for claude sessions
```

Add the menu item after "Copy Session ID" and before "Rename":

```tsx
{props.onFork && props.forkVisible ? (
    <button
        type="button"
        role="menuitem"
        className={`${baseItemClassName} hover:bg-[var(--app-subtle-bg)]`}
        onClick={() => { props.onFork?.(); props.onClose(); }}
        disabled={props.sessionActive}
    >
        <ForkIcon className="text-[var(--app-hint)]" />
        {t('session.action.fork')}
    </button>
) : null}
```

Define `ForkIcon` as an inline SVG (git-branch-like) in `SessionActionMenu.tsx`:

```tsx
function ForkIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><path d="M12 12v3" />
        </svg>
    )
}
```

- [ ] **Step 6: Wire up fork in `SessionList.tsx`**

In `web/src/components/SessionList.tsx`, where `<SessionActionMenu>` is rendered, add:

```tsx
<SessionActionMenu
    ...existing props...
    onCopyId={() => { ... }}
    forkVisible={s.metadata?.flavor === 'claude'}
    onFork={async () => {
        if (s.active) {
            addToast({ title: t('session.action.forkError'), body: 'Session must be inactive', sessionId: s.id, url: '' })
            return
        }
        addToast({ title: t('session.action.forking'), body: '', sessionId: s.id, url: '' })
        try {
            const newSessionId = await api.forkSession(s.id)
            addToast({ title: t('session.action.forkSuccess'), body: '', sessionId: newSessionId, url: '' })
            navigate({ to: '/sessions/$sessionId', params: { sessionId: newSessionId } })
        } catch (error) {
            addToast({ title: t('session.action.forkError'), body: String(error), sessionId: s.id, url: '' })
        }
    }}
/>
```

Make sure `api`, `addToast`, and `navigate` are accessible in the `SessionItem` component. `addToast` comes from `useToast()` (already added in Task 1). Check how `navigate` is imported (likely TanStack Router's `useNavigate()`). Check how `api` is available — it may be a prop or from context.

- [ ] **Step 7: Build and verify**

```bash
cd web && npm run build
cd ../hub && npm run build
```

Expected: Both builds succeed.

- [ ] **Step 8: Commit**

```bash
git add hub/src/sync/syncEngine.ts hub/src/web/routes/sessions.ts web/src/api/client.ts web/src/components/SessionActionMenu.tsx web/src/components/SessionList.tsx web/src/lib/locales/en.ts
git commit -m "feat: add Fork Session for Claude sessions via --fork-session CLI flag"
```

---

## Final Verification

- [ ] **Full build check**

```bash
cd /data/shared/zqh/hapi-worktrees/feat-frontend-improve
cd web && npm run build && cd ../hub && npm run build
```

- [ ] **Verify no TypeScript errors**

```bash
cd web && npx tsc --noEmit
cd ../hub && npx tsc --noEmit
```
