import type { TodoItem } from '@hapi/protocol'

export type TodoProgress = {
    items: TodoItem[]
    completed: number
    total: number
} | null

function TodoRing({ completed, total }: { completed: number; total: number }) {
    const pct = total > 0 ? (completed / total) * 100 : 0
    return (
        <svg width="18" height="18" viewBox="0 0 36 36">
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
    const hasTodos = todoProgress !== null && todoProgress.total > 0

    return (
        <button
            type="button"
            onClick={onToggleTodoPanel}
            disabled={!hasTodos}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                showTodoPanel
                    ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                    : 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
            }`}
            title={hasTodos ? `Tasks: ${todoProgress!.completed}/${todoProgress!.total}` : 'No tasks'}
        >
            <TodoRing completed={todoProgress?.completed ?? 0} total={todoProgress?.total ?? 0} />
        </button>
    )
}
