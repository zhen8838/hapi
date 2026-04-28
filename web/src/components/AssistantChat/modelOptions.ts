import { MODEL_OPTIONS } from '@/components/NewSession/types'
import { getClaudeComposerModelOptions, getNextClaudeComposerModel } from './claudeModelOptions'
import type { ClaudeComposerModelOption } from './claudeModelOptions'
import type { ModelOption as ProtocolModelOption } from '@hapi/protocol'

export type ModelOption = ClaudeComposerModelOption

function getDynamicModelOptions(currentModel: string | null | undefined, options: ProtocolModelOption[]): ModelOption[] {
    const normalized = currentModel?.trim() || null
    const mappedOptions: ModelOption[] = [
        { value: null, label: 'Auto' },
        ...options.map((option) => ({
            value: option.value,
            label: option.label
        }))
    ]
    if (normalized && !mappedOptions.some((o) => o.value === normalized)) {
        mappedOptions.splice(1, 0, { value: normalized, label: normalized })
    }
    return mappedOptions
}

function getGeminiModelOptions(currentModel?: string | null): ModelOption[] {
    const options = MODEL_OPTIONS.gemini.map((m) => ({
        value: m.value === 'auto' ? null : m.value,
        label: m.label
    }))
    const normalized = currentModel?.trim() || null
    if (normalized && !options.some((o) => o.value === normalized)) {
        options.splice(1, 0, { value: normalized, label: normalized })
    }
    return options
}

function getNextGeminiModel(currentModel?: string | null): string | null {
    const options = getGeminiModelOptions(currentModel)
    const currentIndex = options.findIndex((o) => o.value === (currentModel ?? null))
    if (currentIndex === -1) {
        return options[0]?.value ?? null
    }
    return options[(currentIndex + 1) % options.length]?.value ?? null
}

function getCodexModelOptions(currentModel?: string | null): ModelOption[] {
    const options = MODEL_OPTIONS.codex.map((m) => ({
        value: m.value === 'auto' ? null : m.value,
        label: m.label
    }))
    const normalized = currentModel?.trim() || null
    if (normalized && !options.some((o) => o.value === normalized)) {
        options.splice(1, 0, { value: normalized, label: normalized })
    }
    return options
}

function getNextCodexModel(currentModel?: string | null): string | null {
    const options = getCodexModelOptions(currentModel)
    const currentIndex = options.findIndex((o) => o.value === (currentModel ?? null))
    if (currentIndex === -1) {
        return options[0]?.value ?? null
    }
    return options[(currentIndex + 1) % options.length]?.value ?? null
}

export function getModelOptionsForFlavor(flavor: string | undefined | null, currentModel?: string | null, options?: ProtocolModelOption[]): ModelOption[] {
    if (options) {
        return getDynamicModelOptions(currentModel, options)
    }
    if (flavor === 'gemini') {
        return getGeminiModelOptions(currentModel)
    }
    if (flavor === 'codex') {
        return getCodexModelOptions(currentModel)
    }
    return getClaudeComposerModelOptions(currentModel)
}

export function getNextModelForFlavor(flavor: string | undefined | null, currentModel?: string | null, options?: ProtocolModelOption[]): string | null {
    if (options) {
        const dynamicOptions = getDynamicModelOptions(currentModel, options)
        const currentIndex = dynamicOptions.findIndex((o) => o.value === (currentModel ?? null))
        if (currentIndex === -1) {
            return dynamicOptions[0]?.value ?? null
        }
        return dynamicOptions[(currentIndex + 1) % dynamicOptions.length]?.value ?? null
    }
    if (flavor === 'gemini') {
        return getNextGeminiModel(currentModel)
    }
    if (flavor === 'codex') {
        return getNextCodexModel(currentModel)
    }
    return getNextClaudeComposerModel(currentModel)
}
