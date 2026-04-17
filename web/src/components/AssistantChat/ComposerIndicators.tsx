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
        <svg width="18" height="18" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            <defs>
                <mask id="bg-shell-front-cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
                    <rect width="400" height="400" fill="white" />
                    <rect x="140" y="50" width="240" height="230" rx="16" fill="black" />
                </mask>
            </defs>
            <g mask="url(#bg-shell-front-cutout)">
                <g transform="translate(30, 130)">
                    <rect width="240" height="230" rx="16" />
                    <line x1="0" y1="50" x2="240" y2="50" />
                    <path d="M 20 110 L 55 150 L 20 190" strokeWidth={20} />
                    <line x1="75" y1="190" x2="135" y2="190" strokeWidth={20} />
                </g>
            </g>
            <g transform="translate(140, 50)">
                <rect width="240" height="230" rx="16" />
                <line x1="30" y1="60" x2="150" y2="60" strokeWidth={22} strokeLinecap="round" />
                <line x1="90" y1="115" x2="210" y2="115" strokeWidth={22} strokeLinecap="round" />
                <line x1="30" y1="170" x2="130" y2="170" strokeWidth={22} strokeLinecap="round" />
            </g>
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
