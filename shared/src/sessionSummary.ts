import type { Session, WorktreeMetadata } from './schemas'

function findAgentSessionId(metadata: Record<string, unknown>): string | undefined {
    for (const key of Object.keys(metadata)) {
        if (key.endsWith('SessionId') && typeof metadata[key] === 'string') {
            return metadata[key] as string
        }
    }
    return undefined
}

export type SessionSummaryMetadata = {
    name?: string
    path: string
    machineId?: string
    agentSessionId?: string
    summary?: { text: string }
    flavor?: string | null
    worktree?: WorktreeMetadata
}

export type SessionSummary = {
    id: string
    active: boolean
    thinking: boolean
    activeAt: number
    updatedAt: number
    metadata: SessionSummaryMetadata | null
    todoProgress: { completed: number; total: number } | null
    pendingRequestsCount: number
    model: string | null
    effort: string | null
}

export function toSessionSummary(session: Session): SessionSummary {
    const pendingRequestsCount = session.agentState?.requests ? Object.keys(session.agentState.requests).length : 0

    const agentSessionId = session.metadata ? findAgentSessionId(session.metadata) : undefined

    const metadata: SessionSummaryMetadata | null = session.metadata ? {
        name: session.metadata.name,
        path: session.metadata.path,
        machineId: session.metadata.machineId ?? undefined,
        agentSessionId,
        summary: session.metadata.summary ? { text: session.metadata.summary.text } : undefined,
        flavor: session.metadata.flavor ?? null,
        worktree: session.metadata.worktree
    } : null

    const todoProgress = session.todos?.length ? {
        completed: session.todos.filter(t => t.status === 'completed').length,
        total: session.todos.length
    } : null

    return {
        id: session.id,
        active: session.active,
        thinking: session.thinking,
        activeAt: session.activeAt,
        updatedAt: session.updatedAt,
        metadata,
        todoProgress,
        pendingRequestsCount,
        model: session.model,
        effort: session.effort
    }
}
