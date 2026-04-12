import { useState, useEffect, useRef, useCallback } from 'react'
import { encode } from 'plantuml-encoder'
import type { SyntaxHighlighterProps } from '@assistant-ui/react-markdown'

const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg'

export function buildPlantUMLUrl(encoded: string): string {
    return `${PLANTUML_SERVER}/${encoded}`
}

type RenderState =
    | { status: 'loading' }
    | { status: 'success'; url: string }
    | { status: 'error'; message: string }

export function PlantUMLDiagram(props: SyntaxHighlighterProps) {
    const { code } = props
    const [state, setState] = useState<RenderState>({ status: 'loading' })
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const encodeDiagram = useCallback((source: string) => {
        try {
            if (!source.trim()) {
                setState({ status: 'error', message: 'Empty PlantUML source' })
                return
            }
            const encoded = encode(source)
            const url = buildPlantUMLUrl(encoded)
            setState({ status: 'success', url })
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
            encodeDiagram(code)
        }, 500)

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [code, encodeDiagram])

    if (state.status === 'loading') {
        return (
            <div className="flex items-center justify-center rounded-md bg-[var(--app-code-bg)] p-4 text-sm text-[var(--app-hint)]">
                Rendering PlantUML diagram...
            </div>
        )
    }

    if (state.status === 'error') {
        return (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
                <p className="font-semibold text-red-400">Failed to render PlantUML diagram</p>
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
        <div className="plantuml-diagram-container flex justify-center overflow-x-auto rounded-md bg-[var(--app-code-bg)] p-4">
            <img
                src={state.url}
                alt="PlantUML diagram"
                className="max-w-full"
                loading="lazy"
            />
        </div>
    )
}
