import type { AgentType, ClaudeEffort, CodexReasoningEffort, SessionType } from './types'

const AGENT_STORAGE_KEY = 'hapi:newSession:agent'
const YOLO_STORAGE_KEY = 'hapi:newSession:yolo'
const SESSION_PROFILES_STORAGE_KEY = 'hapi:newSession:profiles'
const SELECTED_SESSION_PROFILE_STORAGE_KEY = 'hapi:newSession:selectedProfileId'

const VALID_AGENTS: AgentType[] = ['claude', 'codex', 'cursor', 'gemini', 'opencode']
const VALID_CLAUDE_EFFORTS: ClaudeEffort[] = ['auto', 'medium', 'high', 'max']
const VALID_CODEX_REASONING_EFFORTS: CodexReasoningEffort[] = ['default', 'low', 'medium', 'high', 'xhigh']
const VALID_SESSION_TYPES: SessionType[] = ['simple', 'worktree']

export type SessionProfileConfig = {
    agent: AgentType
    model: string
    effort: ClaudeEffort
    modelReasoningEffort: CodexReasoningEffort
    yoloMode: boolean
    sessionType: SessionType
    worktreeName: string
    additionalParameters: string[]
}

export type SessionProfile = {
    id: string
    name: string
    config: SessionProfileConfig
    createdAt: number
    updatedAt: number
}

export function loadPreferredAgent(): AgentType {
    try {
        const stored = localStorage.getItem(AGENT_STORAGE_KEY)
        if (stored && VALID_AGENTS.includes(stored as AgentType)) {
            return stored as AgentType
        }
    } catch {
        // Ignore storage errors
    }
    return 'claude'
}

export function savePreferredAgent(agent: AgentType): void {
    try {
        localStorage.setItem(AGENT_STORAGE_KEY, agent)
    } catch {
        // Ignore storage errors
    }
}

export function loadPreferredYoloMode(): boolean {
    try {
        return localStorage.getItem(YOLO_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

export function savePreferredYoloMode(enabled: boolean): void {
    try {
        localStorage.setItem(YOLO_STORAGE_KEY, enabled ? 'true' : 'false')
    } catch {
        // Ignore storage errors
    }
}

function normalizeSessionProfileConfig(value: unknown): SessionProfileConfig | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const config = value as Record<string, unknown>
    const agent = typeof config.agent === 'string' && VALID_AGENTS.includes(config.agent as AgentType)
        ? config.agent as AgentType
        : null
    if (!agent) {
        return null
    }

    const model = typeof config.model === 'string' ? config.model : 'auto'
    const effort = typeof config.effort === 'string' && VALID_CLAUDE_EFFORTS.includes(config.effort as ClaudeEffort)
        ? config.effort as ClaudeEffort
        : 'auto'
    const modelReasoningEffort = typeof config.modelReasoningEffort === 'string' && VALID_CODEX_REASONING_EFFORTS.includes(config.modelReasoningEffort as CodexReasoningEffort)
        ? config.modelReasoningEffort as CodexReasoningEffort
        : 'default'
    const yoloMode = config.yoloMode === true
    const sessionType = typeof config.sessionType === 'string' && VALID_SESSION_TYPES.includes(config.sessionType as SessionType)
        ? config.sessionType as SessionType
        : 'simple'
    const worktreeName = typeof config.worktreeName === 'string' ? config.worktreeName : ''
    const additionalParameters = Array.isArray(config.additionalParameters)
        ? config.additionalParameters.filter((item): item is string => typeof item === 'string')
        : []

    return {
        agent,
        model,
        effort,
        modelReasoningEffort,
        yoloMode,
        sessionType,
        worktreeName,
        additionalParameters,
    }
}

function normalizeSessionProfile(value: unknown): SessionProfile | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const profile = value as Record<string, unknown>
    const id = typeof profile.id === 'string' && profile.id.trim() ? profile.id : null
    const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : null
    const config = normalizeSessionProfileConfig(profile.config)

    if (!id || !name || !config) {
        return null
    }

    return {
        id,
        name,
        config,
        createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : Date.now(),
        updatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : Date.now(),
    }
}

export function loadSessionProfiles(): SessionProfile[] {
    try {
        const stored = localStorage.getItem(SESSION_PROFILES_STORAGE_KEY)
        if (!stored) {
            return []
        }
        const parsed = JSON.parse(stored)
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed
            .map((item) => normalizeSessionProfile(item))
            .filter((item): item is SessionProfile => item !== null)
            .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

export function saveSessionProfiles(profiles: SessionProfile[]): void {
    try {
        localStorage.setItem(SESSION_PROFILES_STORAGE_KEY, JSON.stringify(profiles))
    } catch {
        // Ignore storage errors
    }
}

export function loadSelectedSessionProfileId(): string | null {
    try {
        const stored = localStorage.getItem(SELECTED_SESSION_PROFILE_STORAGE_KEY)
        return stored && stored.trim() ? stored : null
    } catch {
        return null
    }
}

export function saveSelectedSessionProfileId(profileId: string | null): void {
    try {
        if (!profileId) {
            localStorage.removeItem(SELECTED_SESSION_PROFILE_STORAGE_KEY)
            return
        }
        localStorage.setItem(SELECTED_SESSION_PROFILE_STORAGE_KEY, profileId)
    } catch {
        // Ignore storage errors
    }
}
