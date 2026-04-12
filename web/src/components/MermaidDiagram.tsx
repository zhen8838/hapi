import { useState, useEffect, useRef, useCallback } from 'react'
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

export function MermaidDiagram(props: SyntaxHighlighterProps) {
    const { code } = props
    const [state, setState] = useState<RenderState>({ status: 'loading' })
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        <div
            className="mermaid-svg-container flex justify-center overflow-x-auto rounded-md bg-white p-4"
            dangerouslySetInnerHTML={{ __html: state.svg }}
        />
    )
}
