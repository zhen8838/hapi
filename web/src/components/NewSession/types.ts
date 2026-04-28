import { getDefaultModelOptionsForFlavor, type ModelOption } from '@hapi/protocol'

export type AgentType = 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
export type SessionType = 'simple' | 'worktree'
export type CodexReasoningEffort = 'default' | 'low' | 'medium' | 'high' | 'xhigh'
export type ClaudeEffort = 'auto' | 'medium' | 'high' | 'xhigh' | 'max'

export const MODEL_OPTIONS: Record<AgentType, ModelOption[]> = {
    claude: [
        { value: 'auto', label: 'Auto' },
        { value: 'opus', label: 'Opus' },
        { value: 'opus[1m]', label: 'Opus 1M' },
        { value: 'sonnet', label: 'Sonnet' },
        { value: 'sonnet[1m]', label: 'Sonnet 1M' },
    ],
    codex: [
        { value: 'auto', label: 'Auto' },
        ...getDefaultModelOptionsForFlavor('codex'),
    ],
    cursor: [],
    gemini: [
        { value: 'auto', label: 'Default' },
        ...getDefaultModelOptionsForFlavor('gemini'),
    ],
    opencode: [],
}

export const CODEX_REASONING_EFFORT_OPTIONS: { value: CodexReasoningEffort; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
]

export const CLAUDE_EFFORT_OPTIONS: { value: ClaudeEffort; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
    { value: 'max', label: 'Max' },
]
