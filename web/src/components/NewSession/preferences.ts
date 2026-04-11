import type { PermissionMode, CodexCollaborationMode } from '@/types/api'
import type { AgentType, ClaudeEffort, CodexReasoningEffort, SessionType } from './types'

const SESSION_PROFILES_STORAGE_KEY = 'hapi:newSession:profiles'
const SELECTED_SESSION_PROFILE_STORAGE_KEY = 'hapi:newSession:selectedProfileId'
const AGENT_STORAGE_KEY = 'hapi:newSession:agent'
const YOLO_STORAGE_KEY = 'hapi:newSession:yolo'

/** All localStorage keys used by the old profile system, for migration cleanup */
export const LEGACY_STORAGE_KEYS = [
    SESSION_PROFILES_STORAGE_KEY,
    SELECTED_SESSION_PROFILE_STORAGE_KEY,
    AGENT_STORAGE_KEY,
    YOLO_STORAGE_KEY,
] as const

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
    permissionMode: PermissionMode
    collaborationMode: CodexCollaborationMode
}

export type SessionProfile = {
    id: string
    name: string
    config: SessionProfileConfig
    createdAt: number
    updatedAt: number
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
    const permissionMode = typeof config.permissionMode === 'string' ? config.permissionMode as PermissionMode : 'default'
    const collaborationMode = typeof config.collaborationMode === 'string' ? config.collaborationMode as CodexCollaborationMode : 'default'

    return {
        agent,
        model,
        effort,
        modelReasoningEffort,
        yoloMode,
        sessionType,
        worktreeName,
        additionalParameters,
        permissionMode,
        collaborationMode,
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

/**
 * Load profiles from localStorage (used only for one-time migration).
 * After migration, profiles are stored on disk at ~/.hapi/profiles/.
 */
export function loadLegacySessionProfiles(): SessionProfile[] {
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

/** Clear all legacy localStorage keys after migration */
export function clearLegacyStorage(): void {
    try {
        for (const key of LEGACY_STORAGE_KEYS) {
            localStorage.removeItem(key)
        }
    } catch {
        // Ignore storage errors
    }
}

/** Check if there is legacy data to migrate */
export function hasLegacyData(): boolean {
    try {
        return Boolean(localStorage.getItem(SESSION_PROFILES_STORAGE_KEY))
    } catch {
        return false
    }
}
