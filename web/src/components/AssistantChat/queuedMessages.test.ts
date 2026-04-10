import { describe, expect, it } from 'vitest'
import type { Attachment } from '@assistant-ui/react'
import { extractQueuedAttachments } from './queuedMessages'

describe('queuedMessages', () => {
    it('extracts metadata from queued upload attachments', () => {
        const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
        const attachments = [
            {
                id: 'a1',
                type: 'file',
                name: 'note.txt',
                contentType: 'text/plain',
                file,
                status: { type: 'requires-action', reason: 'composer-send' },
                path: '/tmp/upload/note.txt',
                previewUrl: 'blob:preview'
            }
        ] as unknown as Attachment[]

        expect(extractQueuedAttachments(attachments)).toEqual([
            {
                id: 'a1',
                filename: 'note.txt',
                mimeType: 'text/plain',
                size: 5,
                path: '/tmp/upload/note.txt',
                previewUrl: 'blob:preview'
            }
        ])
    })

    it('skips attachments without uploaded path', () => {
        const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
        const attachments = [
            {
                id: 'a1',
                type: 'file',
                name: 'note.txt',
                contentType: 'text/plain',
                file,
                status: { type: 'running', reason: 'uploading', progress: 50 }
            }
        ] as Attachment[]

        expect(extractQueuedAttachments(attachments)).toEqual([])
    })
})
