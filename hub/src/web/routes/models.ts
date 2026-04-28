import { Hono } from 'hono'
import {
    getDefaultModelOptionsForFlavor,
    isKnownFlavor,
    type AgentFlavor,
    type ModelOption,
} from '@hapi/protocol'
import type { WebAppEnv } from '../middleware/auth'

const FLAVORS: AgentFlavor[] = ['claude', 'codex', 'cursor', 'gemini', 'opencode']

function parseModelOptions(value: string | undefined): ModelOption[] | null {
    if (!value) return null

    try {
        const parsed = JSON.parse(value) as unknown
        if (Array.isArray(parsed)) {
            const options = parsed.flatMap((item): ModelOption[] => {
                if (typeof item === 'string') {
                    const trimmed = item.trim()
                    return trimmed ? [{ value: trimmed, label: trimmed }] : []
                }
                if (item && typeof item === 'object') {
                    const record = item as Record<string, unknown>
                    const modelValue = typeof record.value === 'string' ? record.value.trim() : ''
                    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : modelValue
                    return modelValue ? [{ value: modelValue, label }] : []
                }
                return []
            })
            return options.length > 0 ? options : null
        }
    } catch {
        // Fall through to comma-separated parsing.
    }

    const options = value.split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((model): ModelOption => ({ value: model, label: model }))
    return options.length > 0 ? options : null
}

function getConfiguredModelOptions(flavor: AgentFlavor): ModelOption[] {
    const key = `HAPI_${flavor.toUpperCase()}_MODELS`
    return parseModelOptions(process.env[key]) ?? getDefaultModelOptionsForFlavor(flavor)
}

export function createModelRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/models', (c) => {
        const requestedFlavor = c.req.query('flavor')
        if (requestedFlavor) {
            if (!isKnownFlavor(requestedFlavor)) {
                return c.json({ error: 'Unknown flavor' }, 400)
            }
            return c.json({
                options: {
                    [requestedFlavor]: getConfiguredModelOptions(requestedFlavor)
                }
            })
        }

        return c.json({
            options: Object.fromEntries(FLAVORS.map((flavor) => [
                flavor,
                getConfiguredModelOptions(flavor)
            ]))
        })
    })

    return app
}
