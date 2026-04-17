import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { AttachmentMetadata } from '@/types/api'
import { MessageAttachments } from './MessageAttachments'

// vitest is configured with `globals: false` + no global afterEach(cleanup),
// so testing-library's auto-cleanup does not run. Unmount between tests to
// avoid DOM from an earlier test leaking into queries of the next one.
afterEach(() => {
    cleanup()
})

function makeImageAttachment(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
    return {
        id: 'att-1',
        filename: 'diagram.svg',
        mimeType: 'image/svg+xml',
        size: 1234,
        path: '/uploads/diagram.svg',
        previewUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        ...overrides
    }
}

describe('MessageAttachments', () => {
    it('renders an <img> for an image attachment with a previewUrl', () => {
        render(<MessageAttachments attachments={[makeImageAttachment()]} />)
        const img = screen.getByRole('img', { name: 'diagram.svg' })
        expect(img).toBeTruthy()
        expect(img.getAttribute('src')).toBe('data:image/svg+xml;base64,PHN2Zy8+')
    })

    it('falls back to a FileAttachment card when the <img> errors', () => {
        render(<MessageAttachments attachments={[makeImageAttachment()]} />)
        const img = screen.getByRole('img', { name: 'diagram.svg' })
        fireEvent.error(img)
        // The <img> is gone; FileAttachment shows the filename and formatted size.
        expect(screen.queryByRole('img', { name: 'diagram.svg' })).toBeNull()
        expect(screen.getByText('diagram.svg')).toBeTruthy()
        expect(screen.getByText('1.2 KB')).toBeTruthy()
    })

    it('falls back to a FileAttachment card when the loaded image has zero dimensions', () => {
        render(<MessageAttachments attachments={[makeImageAttachment()]} />)
        const img = screen.getByRole('img', { name: 'diagram.svg' }) as HTMLImageElement
        // Simulate a load where natural dimensions are 0 (e.g. SVG with width="100%"
        // that the browser cannot size inside <img>).
        Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 })
        Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 0 })
        fireEvent.load(img)
        expect(screen.queryByRole('img', { name: 'diagram.svg' })).toBeNull()
        expect(screen.getByText('diagram.svg')).toBeTruthy()
    })

    it('renders a FileAttachment card for non-image attachments', () => {
        const { container } = render(
            <MessageAttachments
                attachments={[makeImageAttachment({
                    id: 'att-2',
                    filename: 'notes.txt',
                    mimeType: 'text/plain',
                    previewUrl: undefined
                })]}
            />
        )
        // No <img> HTML tag (FileIcon renders an <svg>, not an <img>).
        expect(container.querySelector('img')).toBeNull()
        expect(screen.getByText('notes.txt')).toBeTruthy()
    })

    it('renders a FileAttachment card for image mime without previewUrl', () => {
        const { container } = render(
            <MessageAttachments
                attachments={[makeImageAttachment({ previewUrl: undefined })]}
            />
        )
        expect(container.querySelector('img')).toBeNull()
        expect(screen.getByText('diagram.svg')).toBeTruthy()
    })
})
