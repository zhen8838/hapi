import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Mock mermaid before importing the component
const mockRender = vi.fn()
const mockInitialize = vi.fn()

vi.mock('mermaid', () => ({
    default: {
        initialize: mockInitialize,
        render: mockRender,
    },
}))

// Import after mock setup
import { MermaidDiagram } from './MermaidDiagram'

const VALID_CODE = 'graph TD\n    A --> B'
const INVALID_CODE = 'invalid%%mermaid'

describe('MermaidDiagram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders SVG for valid mermaid code', async () => {
        mockRender.mockResolvedValue({ svg: '<svg class="mermaid-svg">diagram</svg>' })

        const { container } = render(
            <MermaidDiagram
                code={VALID_CODE}
                language="mermaid"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        await waitFor(() => {
            const svgContainer = container.querySelector('.mermaid-svg-container')
            expect(svgContainer).toBeTruthy()
            expect(svgContainer!.innerHTML).toContain('mermaid-svg')
        }, { timeout: 2000 })

        expect(mockRender).toHaveBeenCalledOnce()
    })

    it('shows error message with source code on invalid mermaid syntax', async () => {
        mockRender.mockRejectedValue(new Error('Parse error'))

        render(
            <MermaidDiagram
                code={INVALID_CODE}
                language="mermaid"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        await waitFor(() => {
            expect(screen.getByText(/failed to render mermaid diagram/i)).toBeInTheDocument()
        }, { timeout: 2000 })

        // Source should be disclosed in a collapsible details element
        const details = screen.getByText(/source/i).closest('details')
        expect(details).toBeTruthy()
        expect(details!.textContent).toContain(INVALID_CODE)
    })

    it('shows loading state before render completes', () => {
        // Never resolve -- keeps component in loading state
        mockRender.mockReturnValue(new Promise(() => {}))

        render(
            <MermaidDiagram
                code={VALID_CODE}
                language="mermaid"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        // Before debounce fires, should show loading
        expect(screen.getByText(/rendering mermaid diagram/i)).toBeInTheDocument()
    })
})
