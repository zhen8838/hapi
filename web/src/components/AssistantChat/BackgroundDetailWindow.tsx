import { useEffect, useMemo, useRef, useState } from 'react'
import type { DecryptedMessage, Session } from '@/types/api'
import type { ChatBlock } from '@/chat/types'
import { normalizeDecryptedMessage } from '@/chat/normalize'
import { reduceChatBlocks } from '@/chat/reducer'
import { HappyChatProvider, type HappyChatContextValue } from '@/components/AssistantChat/context'
import { HappyNestedBlockList } from '@/components/AssistantChat/messages/ToolMessage'

type BackgroundTask = NonNullable<Session['backgroundTasks']>[number]
type OutputState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'loaded'; messages: unknown[] }
    | { status: 'error'; error: string }

export function BackgroundDetailWindow({
    tasks,
    panelType,
    readOutput,
    chatContext,
    onKillTask,
}: {
    tasks: BackgroundTask[]
    panelType: 'agents' | 'shells'
    readOutput?: (taskId: string) => Promise<unknown[]>
    chatContext?: HappyChatContextValue
    onKillTask?: (taskId: string) => void
}) {
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)
    const historyRef = useRef<HTMLDivElement | null>(null)
    const lastTopRunningIdRef = useRef<string | null>(null)

    const ordered = useMemo(() => orderBackgroundTasks(tasks), [tasks])
    const historyTasks = ordered.completed
    const visibleTasks = ordered.running
    const active = tasks.find(t => t.id === activeTaskId) ?? visibleTasks[0] ?? historyTasks[0]
    const activeIsHistory = Boolean(active && historyTasks.some(t => t.id === active.id))
    const showTabs = visibleTasks.length > 0 || historyTasks.length > 0
    const historyTabLabel = activeIsHistory && active
        ? truncate(active.description || active.command || active.id, 24)
        : 'History'

    useEffect(() => {
        const firstRunning = ordered.running[0]?.id ?? null
        if (firstRunning && firstRunning !== lastTopRunningIdRef.current) {
            lastTopRunningIdRef.current = firstRunning
            setActiveTaskId(firstRunning)
            setHistoryOpen(false)
            return
        }

        lastTopRunningIdRef.current = firstRunning
        if (activeTaskId && tasks.some(t => t.id === activeTaskId)) return
        setActiveTaskId(visibleTasks[0]?.id ?? historyTasks[0]?.id ?? null)
    }, [activeTaskId, historyTasks, ordered.running, tasks, visibleTasks])

    useEffect(() => {
        if (!historyOpen) return

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target
            if (target instanceof Node && historyRef.current?.contains(target)) return
            setHistoryOpen(false)
        }

        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [historyOpen])

    if (tasks.length === 0) {
        return (
            <div className="mt-2 overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)] px-4 py-3 text-xs text-[var(--app-hint)]">
                No background {panelType}
            </div>
        )
    }

    const activeTabClass = panelType === 'agents' ? 'border-blue-400 text-blue-400' : 'border-emerald-400 text-emerald-400'
    const inactiveTabClass = 'border-transparent text-[var(--app-hint)] hover:text-[var(--app-fg)]'
    const runningDotClass = panelType === 'agents' ? 'animate-pulse bg-blue-400' : 'animate-pulse bg-emerald-400'

    return (
        <div className="relative mt-2 overflow-visible rounded-[20px] bg-[var(--app-secondary-bg)] text-xs">
            {showTabs ? (
                <div ref={historyRef}>
                    <div className="flex overflow-x-auto rounded-t-[20px] border-b border-[var(--app-border)]">
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    if (historyTasks.length === 0) return
                                    setHistoryOpen(open => !open)
                                }}
                                disabled={historyTasks.length === 0}
                                className={`h-full shrink-0 border-b-2 px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                    activeIsHistory ? activeTabClass : inactiveTabClass
                                }`}
                            >
                                {historyTabLabel}
                                <span className="ml-1 text-[10px]">{historyOpen ? '▴' : '▾'}</span>
                            </button>
                        </div>

                        {visibleTasks.map((task, i) => (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => {
                                    setActiveTaskId(task.id)
                                    setHistoryOpen(false)
                                }}
                                className={`shrink-0 border-b-2 px-3 py-1.5 transition-colors ${
                                    task.id === active?.id ? activeTabClass : inactiveTabClass
                                }`}
                            >
                                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${task.status === 'running' ? runningDotClass : 'bg-emerald-500'}`} />
                                {truncate(task.description || task.command || `#${i + 1}`, 24)}
                            </button>
                        ))}
                    </div>
                    {historyOpen && historyTasks.length > 0 ? (
                        <div className="absolute left-1 top-8 z-30 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] py-1 shadow-xl">
                            {historyTasks.map((task) => (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveTaskId(task.id)
                                        setHistoryOpen(false)
                                    }}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--app-subtle-bg)] ${
                                        task.id === active?.id ? 'text-[var(--app-fg)]' : 'text-[var(--app-hint)]'
                                    }`}
                                >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                    <span className="min-w-0 flex-1 truncate">
                                        {task.description || task.command || task.id}
                                    </span>
                                    <span className="shrink-0 text-[10px] opacity-75">
                                        {formatTaskTime(task)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
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

                    <TaskDetail task={active} panelType={panelType} readOutput={readOutput} chatContext={chatContext} />
                </div>
            ) : null}
        </div>
    )
}

function TaskDetail({
    task,
    panelType,
    readOutput,
    chatContext,
}: {
    task: BackgroundTask
    panelType: 'agents' | 'shells'
    readOutput?: (taskId: string) => Promise<unknown[]>
    chatContext?: HappyChatContextValue
}) {
    const [output, setOutput] = useState<OutputState>({ status: 'idle' })
    const outputBlocks = useMemo(
        () => output.status === 'loaded' ? parseAgentOutputBlocks(output.messages) : [],
        [output]
    )

    useEffect(() => {
        if (!task.outputFile || !readOutput) {
            setOutput({ status: 'idle' })
            return
        }

        let canceled = false
        const load = () => {
            setOutput(current => current.status === 'idle' ? { status: 'loading' } : current)
            readOutput(task.id)
                .then((messages) => {
                    if (!canceled) setOutput({ status: 'loaded', messages })
                })
                .catch((error) => {
                    if (!canceled) {
                        setOutput({ status: 'error', error: error instanceof Error ? error.message : String(error) })
                    }
                })
        }

        load()
        const interval = task.status === 'running' ? window.setInterval(load, 2000) : null

        return () => {
            canceled = true
            if (interval !== null) window.clearInterval(interval)
        }
    }, [panelType, readOutput, task.id, task.outputFile, task.status])

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

            {task.description ? (
                <div>
                    <div className="mb-1 text-[var(--app-hint)]">Task:</div>
                    <div className="text-[var(--app-fg)]">{task.description}</div>
                </div>
            ) : null}

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

            {task.outputFile ? (
                <div>
                    <div className="mb-1 text-[var(--app-hint)]">Output:</div>
                    <div className="max-h-72 overflow-y-auto rounded-md bg-[var(--app-bg)] p-2 text-[13px] leading-relaxed text-[var(--app-fg)]">
                        <RenderedOutput output={output} blocks={outputBlocks} chatContext={chatContext} />
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function orderBackgroundTasks(tasks: BackgroundTask[]): { running: BackgroundTask[]; completed: BackgroundTask[] } {
    const byNewest = (a: BackgroundTask, b: BackgroundTask) => taskSortTime(b) - taskSortTime(a)
    return {
        running: tasks.filter(t => t.status === 'running').sort(byNewest),
        completed: tasks.filter(t => t.status === 'completed').sort(byNewest),
    }
}

function taskSortTime(task: BackgroundTask): number {
    return task.completedAt ?? task.startedAt
}

function truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function formatTaskTime(task: BackgroundTask): string {
    const time = task.completedAt ?? task.startedAt
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

function RenderedOutput({
    output,
    blocks,
    chatContext,
}: {
    output: OutputState
    blocks: ChatBlock[]
    chatContext?: HappyChatContextValue
}) {
    if (output.status === 'loading') return <span className="text-[var(--app-hint)]">Loading output...</span>
    if (output.status === 'error') {
        return (
            <span className="text-[var(--app-hint)]">
                {isMissingOutputError(output.error) ? 'Output file is no longer available' : output.error}
            </span>
        )
    }
    if (output.status !== 'loaded') return <span className="text-[var(--app-hint)]">Output not loaded</span>
    if (blocks.length === 0) return <span className="text-[var(--app-hint)]">No output</span>

    const content = (
        <div className="happy-thread-messages flex flex-col gap-3">
            <HappyNestedBlockList blocks={blocks} />
        </div>
    )

    return chatContext ? (
        <HappyChatProvider value={chatContext}>
            {content}
        </HappyChatProvider>
    ) : content
}

function isMissingOutputError(error: string): boolean {
    return error.includes('ENOENT') || error.toLowerCase().includes('no such file')
}

function parseAgentOutputBlocks(records: unknown[]): ChatBlock[] {
    const messages: DecryptedMessage[] = []

    records.forEach((record, index) => {
        if (!isRecord(record)) return
        const data = { ...record, isSidechain: false }
        messages.push({
            id: `background-output:${index}`,
            seq: index,
            localId: null,
            createdAt: Date.now() + index,
            content: {
                role: 'agent',
                content: {
                    type: 'output',
                    data
                }
            }
        })
    })

    const normalized = messages
        .map(normalizeDecryptedMessage)
        .filter((message): message is NonNullable<ReturnType<typeof normalizeDecryptedMessage>> => message !== null)

    return reduceChatBlocks(normalized, null).blocks
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}
