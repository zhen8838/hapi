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
