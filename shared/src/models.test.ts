import { describe, expect, test } from 'bun:test'
import {
    CLAUDE_MODEL_PRESETS,
    CLAUDE_MODEL_LABELS,
    CODEX_MODEL_PRESETS,
    DEFAULT_GEMINI_MODEL,
    GEMINI_MODEL_LABELS,
    GEMINI_MODEL_PRESETS,
    getClaudeModelLabel,
    getDefaultModelOptionsForFlavor,
    isClaudeModelPreset,
} from './models'

describe('isClaudeModelPreset', () => {
    test('accepts valid presets', () => {
        for (const preset of CLAUDE_MODEL_PRESETS) {
            expect(isClaudeModelPreset(preset)).toBe(true)
        }
    })

    test('rejects unknown model string', () => {
        expect(isClaudeModelPreset('haiku')).toBe(false)
    })

    test('rejects null and undefined', () => {
        expect(isClaudeModelPreset(null)).toBe(false)
        expect(isClaudeModelPreset(undefined)).toBe(false)
    })
})

describe('getClaudeModelLabel', () => {
    test('returns label for known presets', () => {
        expect(getClaudeModelLabel('sonnet')).toBe('Sonnet')
        expect(getClaudeModelLabel('opus')).toBe('Opus')
        expect(getClaudeModelLabel('opus[1m]')).toBe('Opus 1M')
    })

    test('trims whitespace before lookup', () => {
        expect(getClaudeModelLabel('  sonnet  ')).toBe('Sonnet')
    })

    test('returns null for unknown model', () => {
        expect(getClaudeModelLabel('haiku')).toBeNull()
    })

    test('returns null for empty/whitespace-only string', () => {
        expect(getClaudeModelLabel('')).toBeNull()
        expect(getClaudeModelLabel('   ')).toBeNull()
    })
})

describe('model constants consistency', () => {
    test('every CLAUDE_MODEL_PRESET has a label', () => {
        for (const preset of CLAUDE_MODEL_PRESETS) {
            expect(CLAUDE_MODEL_LABELS[preset]).toBeDefined()
        }
    })

    test('every GEMINI_MODEL_PRESET has a label', () => {
        for (const preset of GEMINI_MODEL_PRESETS) {
            expect(GEMINI_MODEL_LABELS[preset]).toBeDefined()
        }
    })

    test('DEFAULT_GEMINI_MODEL is a valid preset', () => {
        expect(GEMINI_MODEL_PRESETS).toContain(DEFAULT_GEMINI_MODEL)
    })
})

describe('getDefaultModelOptionsForFlavor', () => {
    test('returns Codex presets with friendly labels', () => {
        const options = getDefaultModelOptionsForFlavor('codex')
        expect(options[0]).toEqual({ value: 'gpt-5.5', label: 'GPT-5.5' })
        expect(options.map((option) => option.value)).toEqual(CODEX_MODEL_PRESETS)
    })
})
