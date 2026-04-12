import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock plantuml-encoder before importing the component
const { mockEncode } = vi.hoisted(() => {
    const mockEncode = vi.fn()
    return { mockEncode }
})

vi.mock('plantuml-encoder', () => ({
    encode: mockEncode,
    default: { encode: mockEncode },
}))

// Import after mock setup
import { PlantUMLDiagram, buildPlantUMLUrl } from './PlantUMLDiagram'

const VALID_CODE = '@startuml\nAlice -> Bob: hello\n@enduml'
const INVALID_CODE = '' // empty string triggers error

describe('PlantUMLDiagram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows loading state initially', () => {
        mockEncode.mockReturnValue('SomeEncodedString')

        render(
            <PlantUMLDiagram
                code={VALID_CODE}
                language="plantuml"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        expect(screen.getByText(/rendering plantuml diagram/i)).toBeInTheDocument()
    })

    it('renders an img tag with the correct PlantUML server URL', async () => {
        mockEncode.mockReturnValue('SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKi1IW80')

        const { container } = render(
            <PlantUMLDiagram
                code={VALID_CODE}
                language="plantuml"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        await waitFor(() => {
            const img = container.querySelector('img')
            expect(img).toBeTruthy()
            expect(img!.src).toContain('https://www.plantuml.com/plantuml/svg/')
            expect(img!.src).toContain('SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKi1IW80')
        }, { timeout: 2000 })

        expect(mockEncode).toHaveBeenCalledWith(VALID_CODE)
    })

    it('shows error with collapsible source when encoding fails', async () => {
        mockEncode.mockImplementation(() => {
            throw new Error('Encoding failed')
        })

        render(
            <PlantUMLDiagram
                code={VALID_CODE}
                language="plantuml"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        await waitFor(() => {
            expect(screen.getByText(/failed to render plantuml diagram/i)).toBeInTheDocument()
        }, { timeout: 2000 })

        // Source should be disclosed in a collapsible details element
        const details = screen.getByText(/source/i).closest('details')
        expect(details).toBeTruthy()
        expect(details!.textContent).toContain(VALID_CODE)
    })

    it('shows error when code is empty', async () => {
        render(
            <PlantUMLDiagram
                code={INVALID_CODE}
                language="plantuml"
                components={{ Pre: 'pre' as any, Code: 'code' as any }}
            />
        )

        await waitFor(() => {
            expect(screen.getByText(/failed to render plantuml diagram/i)).toBeInTheDocument()
        }, { timeout: 2000 })
    })
})

describe('buildPlantUMLUrl', () => {
    it('builds the correct SVG URL', () => {
        const encoded = 'SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKi1IW80'
        const url = buildPlantUMLUrl(encoded)
        expect(url).toBe(`https://www.plantuml.com/plantuml/svg/${encoded}`)
    })
})
