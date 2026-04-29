import type { AgentState, Session, SessionSummary } from '@/types/api'

export type MainAgentState = 'offline' | 'idle' | 'processing' | 'waitingPermission'
export type SessionRowIndicator = 'none' | 'processing' | 'waitingPermission'
export type MainAgentStateEvent = 'readyForInput' | 'permissionRequired'

function hasPendingPermissionRequests(agentState: AgentState | null | undefined): boolean {
    return Boolean(agentState?.requests && Object.keys(agentState.requests).length > 0)
}

export function isMainAgentTurnInFlight(state: MainAgentState): boolean {
    return state === 'processing' || state === 'waitingPermission'
}

export function getMainAgentState(session: Pick<Session, 'active' | 'thinking' | 'agentState'>): MainAgentState {
    if (!session.active) {
        return 'offline'
    }
    if (hasPendingPermissionRequests(session.agentState)) {
        return 'waitingPermission'
    }
    if (session.thinking) {
        return 'processing'
    }
    return 'idle'
}

export function getSessionSummaryState(session: Pick<SessionSummary, 'active' | 'thinking' | 'pendingRequestsCount'>): MainAgentState {
    if (!session.active) {
        return 'offline'
    }
    if (session.pendingRequestsCount > 0) {
        return 'waitingPermission'
    }
    if (session.thinking) {
        return 'processing'
    }
    return 'idle'
}

export function shouldShowStopControl(session: Pick<Session, 'active' | 'thinking' | 'agentState' | 'backgroundTaskCount'>): boolean {
    const state = getMainAgentState(session)
    return state !== 'offline' && (isMainAgentTurnInFlight(state) || (session.backgroundTaskCount ?? 0) > 0)
}

export function getSessionRowIndicator(session: Pick<SessionSummary, 'active' | 'thinking' | 'pendingRequestsCount'>): SessionRowIndicator {
    const state = getSessionSummaryState(session)
    if (state === 'waitingPermission') {
        return 'waitingPermission'
    }
    if (state === 'processing') {
        return 'processing'
    }
    return 'none'
}

export function getMainAgentStateEvents(previous: MainAgentState, next: MainAgentState): MainAgentStateEvent[] {
    const events: MainAgentStateEvent[] = []
    if (previous !== 'waitingPermission' && next === 'waitingPermission') {
        events.push('permissionRequired')
    }
    if (isMainAgentTurnInFlight(previous) && next === 'idle') {
        events.push('readyForInput')
    }
    return events
}

export function getMainAgentStateEventsForSession(
    previous: Pick<Session, 'active' | 'thinking' | 'agentState'>,
    next: Pick<Session, 'active' | 'thinking' | 'agentState'>
): MainAgentStateEvent[] {
    return getMainAgentStateEvents(getMainAgentState(previous), getMainAgentState(next))
}
