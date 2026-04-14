import type { TodoItem } from '@hapi/protocol'

export type TodoProgress = {
    items: TodoItem[]
    completed: number
    total: number
} | null

export type PanelKey = 'todos' | 'agents' | 'shells'

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

function LightningIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}

function BackgroundShellIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" strokeDasharray="3 2" />
            <polyline points="6 12 10 16 6 20" />
            <line x1="12" y1="20" x2="18" y2="20" />
            <circle cx="20" cy="4" r="3" fill="currentColor" stroke="none" />
        </svg>
    )
}

type ComposerIndicatorsProps = {
    todoProgress: TodoProgress
    backgroundTaskCount: number
    openPanels: Set<PanelKey>
    onTogglePanel: (panel: PanelKey) => void
}

export function ComposerIndicators({ todoProgress, backgroundTaskCount, openPanels, onTogglePanel }: ComposerIndicatorsProps) {
    const hasTodos = todoProgress !== null && todoProgress.total > 0
    const hasBg = backgroundTaskCount > 0

    return (
        <div className="flex items-center gap-0.5">
            <button
                type="button"
                onClick={() => onTogglePanel('todos')}
                disabled={!hasTodos}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    openPanels.has('todos')
                        ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                        : hasTodos
                            ? 'text-[var(--app-fg)]/60 hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]'
                            : 'text-[var(--app-hint)]'
                }`}
                title={hasTodos ? `Tasks: ${todoProgress!.completed}/${todoProgress!.total}` : 'No tasks'}
            >
                <TodoRing completed={todoProgress?.completed ?? 0} total={todoProgress?.total ?? 0} />
            </button>
            <button
                type="button"
                onClick={() => onTogglePanel('agents')}
                disabled={!hasBg}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    openPanels.has('agents')
                        ? 'bg-[var(--app-bg)] text-blue-400'
                        : hasBg
                            ? 'text-[var(--app-hint)] hover:bg-[var(--app-bg)] hover:text-blue-400'
                            : 'text-[var(--app-hint)]'
                }`}
                title={hasBg ? `Background agent(s)` : 'No background agents'}
            >
                <LightningIcon />
            </button>
            <button
                type="button"
                onClick={() => onTogglePanel('shells')}
                disabled={!hasBg}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    openPanels.has('shells')
                        ? 'bg-[var(--app-bg)] text-emerald-400'
                        : hasBg
                            ? 'text-[var(--app-hint)] hover:bg-[var(--app-bg)] hover:text-emerald-400'
                            : 'text-[var(--app-hint)]'
                }`}
                title={hasBg ? `Background shell(s)` : 'No background shells'}
            >
                <BackgroundShellIcon />
            </button>
        </div>
    )
}
