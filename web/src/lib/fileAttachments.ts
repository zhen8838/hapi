import type { UploadFileResponse } from '@/types/api'
import { uuid } from '@/utils/uuid'

export type FileAttachment = {
    id: string
    file: File
    status: 'uploading' | 'complete' | 'error'
    path?: string
    error?: string
}

export type UploadFunction = (file: File) => Promise<UploadFileResponse>

export function createFileAttachment(file: File): FileAttachment {
    return {
        id: uuid(),
        file,
        status: 'uploading'
    }
}

export function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/')
}
