import type { Attachment } from '@assistant-ui/react'
import type { AttachmentMetadata } from '@/types/api'

export type QueuedComposerMessage = {
    id: string
    text: string
    attachments?: AttachmentMetadata[]
}

type PendingUploadAttachment = Attachment & {
    path?: string
    previewUrl?: string
}

export function extractQueuedAttachments(attachments: readonly Attachment[]): AttachmentMetadata[] {
    const extracted: AttachmentMetadata[] = []

    for (const attachment of attachments) {
        const pending = attachment as PendingUploadAttachment
        if (!pending.path) continue

        extracted.push({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.contentType ?? 'application/octet-stream',
            size: attachment.file?.size ?? 0,
            path: pending.path,
            previewUrl: pending.previewUrl
        })
    }

    return extracted
}
