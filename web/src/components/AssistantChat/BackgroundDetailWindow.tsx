import { useState } from 'react'
import type { Session } from '@/types/api'

type BackgroundTask = NonNullable<Session['backgroundTasks']>[number]

export function BackgroundDetailWindow({
    tasks,
    panelType,
    onKillTask,
}: {
    tasks: BackgroundTask[]
    panelType: 'agents' | 'shells'
    onKillTask?: (taskId: string) => void
}) {
    const [activeIdx, setActiveIdx] = useState(0)
    const safeIdx = Math.min(activeIdx, Math.max(0, tasks.length - 1))
    const active = tasks[safeIdx]

    if (tasks.length === 0) {
        return (
            <div className="mt-2 overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)] px-4 py-3 text-xs text-[var(--app-hint)]">
                No background {panelType}
            </div>
        )
    }

    const accentColor = panelType === 'agents' ? 'blue' : 'emerald'

    return (
        <div className="mt-2 overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)] text-xs">
            {/* Tabs — one per task */}
            {tasks.length > 1 ? (
                <div className="flex overflow-x-auto border-b border-[var(--app-border)]">
                    {tasks.map((task, i) => (
                        <button
                            key={task.id}
                            type="button"
                            onClick={() => setActiveIdx(i)}
                            className={`shrink-0 border-b-2 px-3 py-1.5 transition-colors ${
                                i === safeIdx
                                    ? `border-${accentColor}-400 text-${accentColor}-400`
                                    : 'border-transparent text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                            }`}
                        >
                            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                                task.status === 'running' ? `animate-pulse bg-${accentColor}-400` : 'bg-emerald-500'
                            }`} />
                            {truncate(task.description || task.command || `#${i + 1}`, 24)}
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Detail area */}
            {active ? (
                <div className="relative">
                    {/* Kill button */}
                    {active.status === 'running' && onKillTask ? (
                        <button
                            type="button"
                            onClick={() => onKillTask(active.id)}
                            className="absolute right-3 top-2 rounded p-0.5 text-[var(--app-hint)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="Stop task"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                            </svg>
                        </button>
                    ) : null}

                    <TaskDetail task={active} panelType={panelType} />
                </div>
            ) : null}
        </div>
    )
}

function TaskDetail({ task, panelType }: { task: BackgroundTask; panelType: 'agents' | 'shells' }) {
    return (
        <div className="space-y-2 px-4 py-3 pr-10">
            <div className="flex items-center gap-2">
                <span className="text-[var(--app-hint)]">Status:</span>
                <span className={task.status === 'running' ? 'text-blue-400' : 'text-emerald-500'}>
                    {task.status}
                </span>
                {task.subagentType ? (
                    <>
                        <span className="text-[var(--app-hint)]">·</span>
                        <span className="text-[var(--app-fg)]">{task.subagentType}</span>
                    </>
                ) : null}
            </div>

            {panelType === 'shells' && task.command ? (
                <div>
                    <div className="mb-1 text-[var(--app-hint)]">Command:</div>
                    <div className="overflow-x-auto rounded-md bg-[var(--app-bg)] p-2 font-mono text-[11px] text-[var(--app-fg)]">
                        {task.command}
                    </div>
                </div>
            ) : null}

            {task.prompt ? (
                <div>
                    <div className="mb-1 text-[var(--app-hint)]">Prompt:</div>
                    <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--app-bg)] p-2 text-[11px] text-[var(--app-fg)]">
                        {task.prompt}
                    </div>
                </div>
            ) : null}

            {task.summary ? (
                <div>
                    <div className="mb-1 text-[var(--app-hint)]">Summary:</div>
                    <div className="text-[var(--app-fg)]">{task.summary}</div>
                </div>
            ) : null}
        </div>
    )
}

function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}
