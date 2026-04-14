import type { TodoItem } from '@hapi/protocol'

export type TodoProgress = {
    items: TodoItem[]
    completed: number
    total: number
} | null

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

type ComposerIndicatorsProps = {
    todoProgress: TodoProgress
    showTodoPanel: boolean
    onToggleTodoPanel: () => void
}

export function ComposerIndicators({ todoProgress, showTodoPanel, onToggleTodoPanel }: ComposerIndicatorsProps) {
    if (!todoProgress || todoProgress.total === 0) return null

    return (
        <>
            <div className="mx-1 h-4 w-px bg-[var(--app-border)]" />
            <button
                type="button"
                onClick={onToggleTodoPanel}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                    showTodoPanel
                        ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                        : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                }`}
                title={`Tasks: ${todoProgress.completed}/${todoProgress.total}`}
            >
                <TodoRing completed={todoProgress.completed} total={todoProgress.total} />
                <span>{todoProgress.completed}/{todoProgress.total}</span>
            </button>
        </>
    )
}
