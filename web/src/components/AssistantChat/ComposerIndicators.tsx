import type { TodoItem } from '@hapi/protocol'

export type TodoProgress = {
    items: TodoItem[]
    completed: number
    total: number
} | null

export type IndicatorPanel = 'todos' | 'background' | null

type ComposerIndicatorsProps = {
    todoProgress: TodoProgress
    backgroundTaskCount: number
    activePanel: IndicatorPanel
    onTogglePanel: (panel: IndicatorPanel) => void
}

function TodoRing({ completed, total }: { completed: number; total: number }) {
    const pct = total > 0 ? (completed / total) * 100 : 0
    return (
        <svg width="14" height="14" viewBox="0 0 36 36">
            <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={3}
            />
            <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeDasharray={`${pct}, 100`}
            />
        </svg>
    )
}

function LightningIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}

export function ComposerIndicators({ todoProgress, backgroundTaskCount, activePanel, onTogglePanel }: ComposerIndicatorsProps) {
    const hasTodos = todoProgress !== null && todoProgress.total > 0
    const hasBg = backgroundTaskCount > 0

    if (!hasTodos && !hasBg) return null

    return (
        <div className="flex items-center gap-1">
            <div className="mx-1 h-4 w-px bg-[var(--app-border)]" />
            {hasTodos ? (
                <button
                    type="button"
                    onClick={() => onTogglePanel(activePanel === 'todos' ? null : 'todos')}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                        activePanel === 'todos'
                            ? 'bg-[var(--app-link)] text-white'
                            : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                    }`}
                    title={`Tasks: ${todoProgress!.completed}/${todoProgress!.total}`}
                >
                    <TodoRing completed={todoProgress!.completed} total={todoProgress!.total} />
                    <span>{todoProgress!.completed}/{todoProgress!.total}</span>
                </button>
            ) : null}
            {hasBg ? (
                <button
                    type="button"
                    onClick={() => onTogglePanel(activePanel === 'background' ? null : 'background')}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                        activePanel === 'background'
                            ? 'bg-[var(--app-link)] text-white'
                            : 'text-blue-400 hover:bg-[var(--app-bg)]'
                    }`}
                    title={`${backgroundTaskCount} background task(s)`}
                >
                    <LightningIcon />
                    <span>{backgroundTaskCount}</span>
                </button>
            ) : null}
        </div>
    )
}
