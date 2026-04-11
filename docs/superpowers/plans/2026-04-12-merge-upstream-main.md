# Merge Upstream Main Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 14 upstream commits from `origin/main` into `hapi-feat-frontend-improve-v2`, resolving 3 file conflicts while preserving our queue, fork, and composer features.

**Architecture:** Direct `git merge origin/main` with manual conflict resolution for 3 files. 7 other shared files auto-merge. One modification to upstream's `useSidebarResize` hook after merge.

**Tech Stack:** TypeScript, React, Git

**Spec:** `docs/superpowers/specs/2026-04-11-merge-upstream-main-design.md`

---

## Chunk 1: Execute Merge and Resolve Conflicts

### Task 1: Start the merge

**Files:**
- All files touched by upstream's 14 commits

- [ ] **Step 1: Fetch latest upstream and start merge**

```bash
git fetch origin main
git merge origin/main
```

Expected: merge fails with conflicts in 3 files:
- `web/src/components/AssistantChat/HappyComposer.tsx`
- `web/src/components/SessionList.tsx`
- `web/src/router.tsx`

Do NOT abort. Proceed to conflict resolution tasks.

---

### Task 2: Resolve `web/src/router.tsx`

This is the simplest conflict — take upstream's version entirely.

**Files:**
- Modify: `web/src/router.tsx`

- [ ] **Step 1: Accept upstream's version**

```bash
git checkout --theirs web/src/router.tsx
git add web/src/router.tsx
```

Upstream uses the `useSidebarResize` hook instead of our inline implementation. We will modify the hook in Task 5 to add chat area min-width.

---

### Task 3: Resolve `web/src/components/SessionList.tsx`

Take upstream's 3-level hierarchy redesign as base, then re-add our `onCopyId` and `onFork` props.

**Files:**
- Modify: `web/src/components/SessionList.tsx`

- [ ] **Step 1: Accept upstream's version as base**

```bash
git checkout --theirs web/src/components/SessionList.tsx
```

- [ ] **Step 2: Add our imports**

Add `useNavigate` and `useToast` imports. At the top of the file, after the existing React import line:

```ts
import { useNavigate } from '@tanstack/react-router'
```

And after the existing component imports, add:

```ts
import { useToast } from '@/lib/toast-context'
```

- [ ] **Step 3: Add our hooks inside `SessionItem`**

Inside the `SessionItem` function, after `const { t } = useTranslation()`, add:

```ts
const { addToast } = useToast()
const navigate = useNavigate()
```

- [ ] **Step 4: Add `onCopyId`, `onFork`, and `forkVisible` props to `<SessionActionMenu>`**

Find the `<SessionActionMenu` JSX in `SessionItem`. After the `onDelete` prop, add:

```tsx
onCopyId={() => {
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(s.id).catch(() => {})
        } else {
            const textarea = document.createElement('textarea')
            textarea.value = s.id
            textarea.style.position = 'fixed'
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
        }
    } catch {
        // ignore clipboard errors
    }
    addToast({ title: t('session.action.copyIdDone'), body: s.id, sessionId: '', url: '' })
}}
forkVisible={s.metadata?.flavor === 'claude'}
onFork={async () => {
    if (s.active) {
        addToast({ title: t('session.action.forkError'), body: 'Session must be inactive', sessionId: s.id, url: '' })
        return
    }
    addToast({ title: t('session.action.forking'), body: '', sessionId: s.id, url: '' })
    try {
        const newSessionId = await api!.forkSession(s.id)
        addToast({ title: t('session.action.forkSuccess'), body: '', sessionId: newSessionId, url: '' })
        navigate({ to: '/sessions/$sessionId', params: { sessionId: newSessionId } })
    } catch (error) {
        const msg = String(error)
        const body = msg.includes('resume_unavailable')
            ? 'This session has no Claude session ID. Try resuming it first, then fork.'
            : msg
        addToast({ title: t('session.action.forkError'), body, sessionId: '', url: '' })
    }
}}
```

- [ ] **Step 5: Stage the file**

```bash
git add web/src/components/SessionList.tsx
```

---

### Task 4: Resolve `web/src/components/AssistantChat/HappyComposer.tsx`

This is the most complex conflict. Strategy: start from upstream, then layer our queue system and keyboard behavior on top.

**Files:**
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`

- [ ] **Step 1: Accept upstream's version as base**

```bash
git checkout --theirs web/src/components/AssistantChat/HappyComposer.tsx
```

- [ ] **Step 2: Add our imports**

After the existing imports (after the `getCodexComposerReasoningEffortOptions` import), add:

```ts
import type { AttachmentMetadata } from '@/types/api'
import { makeClientSideId } from '@/lib/messages'
import { extractQueuedAttachments, type QueuedComposerMessage } from './queuedMessages'
```

- [ ] **Step 3: Add our icon components**

After the `defaultSuggestionHandler` function (around line 42), add:

```tsx
function PaperclipIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    )
}

function QueueXIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
    )
}
```

- [ ] **Step 4: Add our props to the component signature**

In the `HappyComposer` props definition, after the voice-related props, add:

```ts
onQueuedSend?: (text: string, attachments?: AttachmentMetadata[]) => void
initialText?: string
onTextChange?: (text: string) => void
```

And in the destructuring block, add `onQueuedSend` to the destructured props.

- [ ] **Step 5: Restore `!threadIsRunning` on canSend and add canQueue**

Find the line (around line 133 in upstream):
```ts
const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled
```

Replace with:
```ts
const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && !threadIsRunning
const canQueue = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && threadIsRunning
```

- [ ] **Step 6: Add queue state and refs**

After the existing `useState` declarations (after `showContinueHint`), add:

```ts
const [queuedMessages, setQueuedMessages] = useState<QueuedComposerMessage[]>([])
```

After the existing `useRef` declarations, add:

```ts
const queueDispatchInFlightRef = useRef(false)
```

- [ ] **Step 7: Add initialText and onTextChange effects**

After the `threadIsDisabled` line, add:

```ts
// Set initial text on mount
useEffect(() => {
    if (props.initialText) {
        api.composer().setText(props.initialText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// Report text changes to parent
useEffect(() => {
    props.onTextChange?.(composerText)
}, [composerText, props.onTextChange])
```

- [ ] **Step 8: Add queue helper functions**

After the `handleAbort` callback, add:

```ts
const clearComposer = useCallback(async () => {
    api.composer().setText('')
    try {
        await api.composer().clearAttachments()
    } catch {
        // Best effort
    }
}, [api])

const enqueueCurrentComposer = useCallback(async () => {
    if (!canQueue) return

    const nextAttachments = hasAttachments ? extractQueuedAttachments(attachments) : []
    const nextQueuedMessage: QueuedComposerMessage = {
        id: makeClientSideId('queued'),
        text: composerText,
        attachments: nextAttachments.length > 0 ? nextAttachments : undefined
    }

    setQueuedMessages((current) => [...current, nextQueuedMessage])
    await clearComposer()
    setShowContinueHint(false)
    haptic('success')
}, [attachments, canQueue, clearComposer, composerText, hasAttachments, haptic])

const removeQueuedMessage = useCallback((id: string) => {
    setQueuedMessages((current) => current.filter((message) => message.id !== id))
}, [])
```

- [ ] **Step 9: Replace keyboard handler**

Replace the entire `handleKeyDown` callback with our version. Find the `const handleKeyDown = useCallback(...)` block and replace it:

```ts
const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key

    // Avoid intercepting IME composition keystrokes (Enter, arrows, etc.)
    if (e.nativeEvent.isComposing) {
        return
    }

    // Enter with suggestions visible: select the suggestion (from upstream)
    if (key === 'Enter' && suggestions.length > 0) {
        e.preventDefault()
        const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
        handleSuggestionSelect(indexToSelect)
        return
    }

    // Ctrl/Cmd+Enter: send or queue (our behavior)
    if (key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (canSend) {
            api.composer().send()
            setShowContinueHint(false)
            return
        }
        if (canQueue) {
            void enqueueCurrentComposer()
        }
        setShowContinueHint(false)
        return
    }

    // Plain Enter: let textarea handle newline (submitOnEnter={false})

    if (suggestions.length > 0) {
        if (key === 'ArrowUp') {
            e.preventDefault()
            moveUp()
            return
        }
        if (key === 'ArrowDown') {
            e.preventDefault()
            moveDown()
            return
        }
        if (key === 'Escape') {
            e.preventDefault()
            clearSuggestions()
            return
        }
        if ((key === 'Tab') && !e.shiftKey) {
            e.preventDefault()
            const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
            handleSuggestionSelect(indexToSelect)
            return
        }
    }

    if (key === 'Escape' && threadIsRunning) {
        e.preventDefault()
        handleAbort()
        return
    }

    // Shift+Tab: cycle permission mode (from upstream)
    if (key === 'Tab' && e.shiftKey && onPermissionModeChange && permissionModes.length > 0) {
        e.preventDefault()
        const currentIndex = permissionModes.indexOf(permissionMode)
        const nextIndex = (currentIndex + 1) % permissionModes.length
        const nextMode = permissionModes[nextIndex] ?? 'default'
        onPermissionModeChange(nextMode)
        haptic('light')
    }
}, [
    suggestions,
    selectedIndex,
    moveUp,
    moveDown,
    clearSuggestions,
    handleSuggestionSelect,
    threadIsRunning,
    handleAbort,
    onPermissionModeChange,
    permissionMode,
    permissionModes,
    canSend,
    canQueue,
    api,
    enqueueCurrentComposer,
    haptic
])
```

- [ ] **Step 10: Replace handleSend and add queue dispatch effect**

Find the existing `handleSend` callback. Replace it with:

```ts
const handleSend = useCallback(() => {
    if (canSend) {
        api.composer().send()
        return
    }
    if (canQueue) {
        void enqueueCurrentComposer()
    }
}, [api, canQueue, canSend, enqueueCurrentComposer])
```

After `handleSend`, add the queue dispatch effect:

```ts
useEffect(() => {
    if (threadIsRunning) {
        queueDispatchInFlightRef.current = false
        return
    }
    if (!onQueuedSend || controlsDisabled || queueDispatchInFlightRef.current) {
        return
    }
    const nextQueuedMessage = queuedMessages[0]
    if (!nextQueuedMessage) {
        return
    }

    queueDispatchInFlightRef.current = true
    setQueuedMessages((current) => current.slice(1))
    onQueuedSend(nextQueuedMessage.text, nextQueuedMessage.attachments)
}, [controlsDisabled, onQueuedSend, queuedMessages, threadIsRunning])
```

- [ ] **Step 11: Remove voice props from ComposerButtons**

In the `<ComposerButtons>` JSX, remove these props:
```
voiceEnabled={voiceEnabled}
voiceStatus={voiceStatus}
voiceMicMuted={voiceMicMuted}
onVoiceToggle={onVoiceToggle ?? (() => {})}
onVoiceMicToggle={onVoiceMicToggle}
```

Also remove the `const voiceEnabled = Boolean(onVoiceToggle)` line.

Add to `<ComposerButtons>`:
```tsx
canQueue={canQueue}
```

- [ ] **Step 12: Remove `max-w-content` from wrapper and add queue UI**

Find the wrapper div:
```tsx
<div className="mx-auto w-full max-w-content">
```
Change to:
```tsx
<div className="mx-auto w-full">
```

Before the `<div className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]">` block, add the queued message cards:

```tsx
{queuedMessages.length > 0 ? (
    <div className="mb-2 flex flex-col gap-2">
        {queuedMessages.map((message) => (
            <div
                key={message.id}
                className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]"
                style={{ maxWidth: '85%' }}
            >
                {message.attachments && message.attachments.length > 0 ? (
                    <div className="flex items-center gap-1 px-4 pt-2.5 text-[11px] text-[var(--app-hint)]">
                        <PaperclipIcon className="h-3 w-3" />
                        <span>{message.attachments.length} {message.attachments.length === 1 ? 'file' : 'files'}</span>
                    </div>
                ) : null}
                <div className="flex items-start gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1 max-h-20 overflow-hidden whitespace-pre-wrap break-words text-base leading-snug text-[var(--app-fg)]" style={{ maskImage: message.text.length > 200 ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined, WebkitMaskImage: message.text.length > 200 ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined }}>
                        {message.text.trim() || t('composer.queueAttachmentOnly')}
                    </div>
                    <button
                        type="button"
                        onClick={() => removeQueuedMessage(message.id)}
                        className="shrink-0 mt-0.5 rounded-full p-0.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                        aria-label={t('composer.queueRemove')}
                    >
                        <QueueXIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        ))}
    </div>
) : null}
```

- [ ] **Step 13: Stage the file**

```bash
git add web/src/components/AssistantChat/HappyComposer.tsx
```

---

### Task 5: Modify upstream's `useSidebarResize` hook

> **Prerequisite:** Task 1 must be completed first — this file arrives via the upstream merge.

Add chat area minimum width guard.

**Files:**
- Modify: `web/src/hooks/useSidebarResize.ts`

- [ ] **Step 1: Add CHAT_MIN constant and update clamp**

In `web/src/hooks/useSidebarResize.ts`, find:

```ts
const MIN_WIDTH = 280
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 420

function clamp(value: number): number {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))
}
```

Replace with:

```ts
const MIN_WIDTH = 280
const MAX_WIDTH = 600
const CHAT_MIN = 400
const DEFAULT_WIDTH = 420

function clamp(value: number): number {
    const maxAllowed = Math.min(MAX_WIDTH, window.innerWidth - CHAT_MIN)
    return Math.min(maxAllowed, Math.max(MIN_WIDTH, value))
}
```

- [ ] **Step 2: Stage the file**

```bash
git add web/src/hooks/useSidebarResize.ts
```

---

### Task 6: Commit the merge

- [ ] **Step 1: Verify all conflicts are resolved**

```bash
git diff --name-only --diff-filter=U
```

Expected: no output (no remaining unmerged files).

- [ ] **Step 2: Commit the merge**

```bash
git commit -m "$(cat <<'EOF'
merge: upstream main into feat-frontend-improve-v2

Resolves 3 conflicts:
- HappyComposer: keep queue semantics (!threadIsRunning), Ctrl/Cmd+Enter keyboard, add upstream reasoning effort
- SessionList: take upstream 3-level hierarchy, re-apply onCopyId/onFork
- router: take upstream useSidebarResize hook, add CHAT_MIN guard

via [HAPI](https://hapi.run)

Co-Authored-By: HAPI <noreply@hapi.run>
EOF
)"
```

---

## Chunk 2: Verify

### Task 7: Typecheck

- [ ] **Step 1: Run typecheck**

```bash
cd /data/shared/zqh/hapi-worktrees/feat-frontend-improve && npx tsc --noEmit
```

Expected: no errors. If there are errors, fix them before proceeding.

### Task 8: Build

- [ ] **Step 1: Run build**

```bash
cd /data/shared/zqh/hapi-worktrees/feat-frontend-improve && npm run build
```

Expected: build succeeds.

- [ ] **Step 2: If typecheck/build pass, commit any fixups**

If any fixes were needed, commit them:

```bash
git add -A && git commit -m "$(cat <<'EOF'
fix: post-merge typecheck/build fixes

via [HAPI](https://hapi.run)

Co-Authored-By: HAPI <noreply@hapi.run>
EOF
)"
```

### Task 9: Enter-key behavior regression

Manual verification in the browser:

- [ ] **Step 1: Plain Enter inserts newline** — open composer, type text, press Enter. Should insert a newline, NOT send.
- [ ] **Step 2: Ctrl/Cmd+Enter sends when idle** — with agent idle, type text, press Ctrl+Enter (or Cmd+Enter on Mac). Message should send.
- [ ] **Step 3: Ctrl/Cmd+Enter queues when running** — while agent is thinking, type text, press Ctrl+Enter. Message should appear as a queued card above the composer, NOT send immediately.
- [ ] **Step 4: Enter with suggestions selects suggestion** — type `/` or trigger autocomplete, press Enter. Should select the suggestion, NOT send or insert newline.
- [ ] **Step 5: Shift+Tab cycles permission mode** — press Shift+Tab in composer. Permission mode should cycle.

### Task 10: Smoke test

Manual verification in the browser:

- [ ] **Step 1: Queue feature** — queue multiple messages while agent is running, verify they display as cards, verify X button removes them, verify they send one-by-one after agent finishes.
- [ ] **Step 2: Fork session** — right-click a Claude session in sidebar, select Fork. Verify new session is created and navigated to.
- [ ] **Step 3: Copy Session ID** — right-click a session, select Copy ID. Verify ID is in clipboard.
- [ ] **Step 4: Sidebar resize** — drag the sidebar resize handle. Verify sidebar respects min 280px and max 600px. Verify chat area never shrinks below 400px.
- [ ] **Step 5: 3-level sidebar hierarchy** — verify sessions are grouped by Machine → Project → Session.
- [ ] **Step 6: Upstream features** — verify LaTeX rendering works in messages, background task count shows in status bar.
