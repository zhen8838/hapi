import type { QueuedComposerMessage } from './queuedMessages'

const STORAGE_PREFIX = 'hapi:queue:'
const queues = new Map<string, QueuedComposerMessage[]>()

// Load from sessionStorage on init
try {
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(STORAGE_PREFIX)) {
            const sessionId = key.slice(STORAGE_PREFIX.length)
            const data = JSON.parse(sessionStorage.getItem(key) ?? '')
            queues.set(sessionId, data)
        }
    }
} catch { /* ignore corrupt storage */ }

export function getQueuedMessages(sessionId: string): QueuedComposerMessage[] {
    return queues.get(sessionId) ?? []
}

export function setQueuedMessages(sessionId: string, messages: QueuedComposerMessage[]): void {
    if (messages.length === 0) {
        clearQueuedMessages(sessionId)
        return
    }
    queues.set(sessionId, messages)
    try {
        sessionStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(messages))
    } catch { /* storage full, in-memory still works */ }
}

export function clearQueuedMessages(sessionId: string): void {
    queues.delete(sessionId)
    try {
        sessionStorage.removeItem(STORAGE_PREFIX + sessionId)
    } catch { /* ignore */ }
}
