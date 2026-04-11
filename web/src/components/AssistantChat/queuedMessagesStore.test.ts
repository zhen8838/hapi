import { describe, it, expect, beforeEach } from 'vitest'
import { getQueuedMessages, setQueuedMessages, clearQueuedMessages } from './queuedMessagesStore'
import type { QueuedComposerMessage } from './queuedMessages'

describe('queuedMessagesStore', () => {
    beforeEach(() => {
        sessionStorage.clear()
        // Clear in-memory state by clearing and re-setting
        clearQueuedMessages('test-session')
    })

    const makeMessage = (id: string, text: string): QueuedComposerMessage => ({
        id,
        text,
    })

    it('returns empty array for unknown session', () => {
        expect(getQueuedMessages('nonexistent')).toEqual([])
    })

    it('persists and retrieves queued messages', () => {
        const messages = [makeMessage('q1', 'hello'), makeMessage('q2', 'world')]
        setQueuedMessages('test-session', messages)

        expect(getQueuedMessages('test-session')).toEqual(messages)
    })

    it('writes to sessionStorage', () => {
        const messages = [makeMessage('q1', 'hello')]
        setQueuedMessages('test-session', messages)

        const stored = sessionStorage.getItem('hapi:queue:test-session')
        expect(stored).not.toBeNull()
        expect(JSON.parse(stored!)).toEqual(messages)
    })

    it('clears messages', () => {
        setQueuedMessages('test-session', [makeMessage('q1', 'hello')])
        clearQueuedMessages('test-session')

        expect(getQueuedMessages('test-session')).toEqual([])
        expect(sessionStorage.getItem('hapi:queue:test-session')).toBeNull()
    })

    it('auto-clears when setting empty array', () => {
        setQueuedMessages('test-session', [makeMessage('q1', 'hello')])
        setQueuedMessages('test-session', [])

        expect(getQueuedMessages('test-session')).toEqual([])
        expect(sessionStorage.getItem('hapi:queue:test-session')).toBeNull()
    })

    it('isolates different sessions', () => {
        setQueuedMessages('session-a', [makeMessage('q1', 'a-msg')])
        setQueuedMessages('session-b', [makeMessage('q2', 'b-msg')])

        expect(getQueuedMessages('session-a')).toEqual([makeMessage('q1', 'a-msg')])
        expect(getQueuedMessages('session-b')).toEqual([makeMessage('q2', 'b-msg')])
    })
})
