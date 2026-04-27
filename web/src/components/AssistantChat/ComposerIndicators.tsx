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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            {/* $ glyph — S-curve with a vertical line through the middle */}
            <path d="M 16.5 6.5 C 16.5 4.5 14.5 3.5 12 3.5 C 9 3.5 7 4.8 7 7 C 7 9.5 9 10.5 12 10.5 C 15 10.5 17 11.5 17 14 C 17 16.2 15 17.5 12 17.5 C 9.5 17.5 7.5 16.5 7.5 14.5" />
            <line x1="12" y1="1.5" x2="12" y2="19.5" />
            {/* _ cursor */}
            <line x1="15" y1="21" x2="21" y2="21" />
        </svg>
    )
}

type ComposerIndicatorsProps = {
    todoProgress: TodoProgress
    backgroundTaskCount: number
    backgroundAgentCount: number
    backgroundShellCount: number
    openPanels: Set<PanelKey>
    onTogglePanel: (panel: PanelKey) => void
}

export function ComposerIndicators({ todoProgress, backgroundTaskCount, backgroundAgentCount, backgroundShellCount, openPanels, onTogglePanel }: ComposerIndicatorsProps) {
    const hasTodos = todoProgress !== null && todoProgress.total > 0
    const hasAgents = backgroundAgentCount > 0
    const hasShells = backgroundShellCount > 0

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
                disabled={!hasAgents}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    openPanels.has('agents')
                        ? 'bg-[var(--app-bg)] text-blue-400'
                        : hasAgents
                            ? 'text-[var(--app-hint)] hover:bg-[var(--app-bg)] hover:text-blue-400'
                            : 'text-[var(--app-hint)]'
                }`}
                title={hasAgents ? `Background agent(s)${backgroundTaskCount > 0 ? `, ${backgroundTaskCount} running` : ''}` : 'No background agents'}
            >
                <LightningIcon />
            </button>
            <button
                type="button"
                onClick={() => onTogglePanel('shells')}
                disabled={!hasShells}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    openPanels.has('shells')
                        ? 'bg-[var(--app-bg)] text-emerald-400'
                        : hasShells
                            ? 'text-[var(--app-hint)] hover:bg-[var(--app-bg)] hover:text-emerald-400'
                            : 'text-[var(--app-hint)]'
                }`}
                title={hasShells ? `Background shell(s)${backgroundTaskCount > 0 ? `, ${backgroundTaskCount} running` : ''}` : 'No background shells'}
            >
                <BackgroundShellIcon />
            </button>
        </div>
    )
}
