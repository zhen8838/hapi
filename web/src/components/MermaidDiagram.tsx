import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { SyntaxHighlighterProps } from '@assistant-ui/react-markdown'

let mermaidInstance: typeof import('mermaid').default | null = null
let mermaidInitialized = false
let idCounter = 0

function getNextId(): string {
    return `mermaid-diagram-${++idCounter}`
}

async function getMermaid() {
    if (!mermaidInstance) {
        const mod = await import('mermaid')
        mermaidInstance = mod.default
    }
    if (!mermaidInitialized) {
        mermaidInstance.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
        })
        mermaidInitialized = true
    }
    return mermaidInstance
}

type RenderState =
    | { status: 'loading' }
    | { status: 'success'; svg: string }
    | { status: 'error'; message: string }

const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const

export function MermaidDiagram(props: SyntaxHighlighterProps) {
    const { code } = props
    const [state, setState] = useState<RenderState>({ status: 'loading' })
    const [zoomIndex, setZoomIndex] = useState(4) // default 100%
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const zoom = ZOOM_LEVELS[zoomIndex]
    const zoomLabel = `${Math.round(zoom * 100)}%`

    const renderDiagram = useCallback(async (source: string) => {
        try {
            const mermaid = await getMermaid()
            const id = getNextId()
            const { svg } = await mermaid.render(id, source)
            setState({ status: 'success', svg })
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setState({ status: 'error', message })
        }
    }, [])

    useEffect(() => {
        setState({ status: 'loading' })

        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        debounceRef.current = setTimeout(() => {
            renderDiagram(code)
        }, 300)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [code, renderDiagram])

    if (state.status === 'loading') {
        return (
            <div className="flex items-center justify-center rounded-md bg-[var(--app-code-bg)] p-4 text-sm text-[var(--app-hint)]">
                Rendering mermaid diagram...
            </div>
        )
    }

    if (state.status === 'error') {
        return (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
                <p className="font-semibold text-red-400">Failed to render Mermaid diagram</p>
                <p className="mt-1 text-red-300/80 text-xs">{state.message}</p>
                <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--app-hint)]">Source</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-[var(--app-code-bg)] p-2 text-xs">
                        <code>{code}</code>
                    </pre>
                </details>
            </div>
        )
    }

    return (
        <div className="rounded-md bg-white">
            <div className="flex items-center justify-end gap-1 px-2 pt-2">
                <button
                    type="button"
                    onClick={() => setZoomIndex(i => Math.max(0, i - 1))}
                    disabled={zoomIndex === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                    −
                </button>
                <span className="min-w-[3rem] text-center text-xs text-gray-500">{zoomLabel}</span>
                <button
                    type="button"
                    onClick={() => setZoomIndex(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
                    disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={() => setZoomIndex(4)}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100"
                >
                    Reset
                </button>
            </div>
            <div className="overflow-auto p-4">
                <div
                    className="mermaid-svg-container flex justify-center origin-top-left"
                    style={{ transform: `scale(${zoom})` }}
                    dangerouslySetInnerHTML={{ __html: state.svg }}
                />
            </div>
        </div>
    )
}
