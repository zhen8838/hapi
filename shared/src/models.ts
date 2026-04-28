import type { AgentFlavor } from './modes'

export type ModelOption = {
    value: string
    label: string
}

export const CLAUDE_MODEL_LABELS = {
    sonnet: 'Sonnet',
    'sonnet[1m]': 'Sonnet 1M',
    opus: 'Opus',
    'opus[1m]': 'Opus 1M'
} as const

export type ClaudeModelPreset = keyof typeof CLAUDE_MODEL_LABELS
export const CLAUDE_MODEL_PRESETS = Object.keys(CLAUDE_MODEL_LABELS) as ClaudeModelPreset[]

export const CODEX_MODEL_LABELS = {
    'gpt-5.5': 'GPT-5.5',
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-mini': 'GPT-5.4 Mini',
    'gpt-5.3-codex': 'GPT-5.3 Codex',
    'gpt-5.2-codex': 'GPT-5.2 Codex',
    'gpt-5.2': 'GPT-5.2',
    'gpt-5.1-codex-max': 'GPT-5.1 Codex Max',
    'gpt-5.1-codex-mini': 'GPT-5.1 Codex Mini',
} as const

export type CodexModelPreset = keyof typeof CODEX_MODEL_LABELS
export const CODEX_MODEL_PRESETS = Object.keys(CODEX_MODEL_LABELS) as CodexModelPreset[]

export const GEMINI_MODEL_LABELS = {
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
    'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
} as const

export type GeminiModelPreset = keyof typeof GEMINI_MODEL_LABELS
export const GEMINI_MODEL_PRESETS = Object.keys(GEMINI_MODEL_LABELS) as GeminiModelPreset[]
export const DEFAULT_GEMINI_MODEL: GeminiModelPreset = 'gemini-2.5-pro'

export function isClaudeModelPreset(model: string | null | undefined): model is ClaudeModelPreset {
    return typeof model === 'string' && Object.hasOwn(CLAUDE_MODEL_LABELS, model)
}

export function getClaudeModelLabel(model: string): string | null {
    const trimmedModel = model.trim()
    if (!trimmedModel) {
        return null
    }

    return CLAUDE_MODEL_LABELS[trimmedModel as ClaudeModelPreset] ?? null
}

function toModelOptions<T extends string>(presets: readonly T[], labels: Record<T, string>): ModelOption[] {
    return presets.map((model) => ({
        value: model,
        label: labels[model]
    }))
}

export function getDefaultModelOptionsForFlavor(flavor: AgentFlavor): ModelOption[] {
    if (flavor === 'claude') {
        return toModelOptions(CLAUDE_MODEL_PRESETS, CLAUDE_MODEL_LABELS)
    }
    if (flavor === 'codex') {
        return toModelOptions(CODEX_MODEL_PRESETS, CODEX_MODEL_LABELS)
    }
    if (flavor === 'gemini') {
        return toModelOptions(GEMINI_MODEL_PRESETS, GEMINI_MODEL_LABELS)
    }
    return []
}
