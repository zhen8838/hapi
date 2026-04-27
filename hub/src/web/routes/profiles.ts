import { Hono } from 'hono'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { z } from 'zod'
import type { WebAppEnv } from '../middleware/auth'

const PROFILES_DIR = join(
    process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi'),
    'profiles'
)

const profileConfigSchema = z.object({
    agent: z.enum(['claude', 'codex', 'cursor', 'gemini', 'opencode']),
    model: z.string().default('auto'),
    effort: z.enum(['auto', 'medium', 'high', 'max']).default('auto'),
    modelReasoningEffort: z.enum(['default', 'low', 'medium', 'high', 'xhigh']).default('default'),
    yoloMode: z.boolean().default(false),
    sessionType: z.enum(['simple', 'worktree']).default('simple'),
    worktreeName: z.string().default(''),
    additionalParameters: z.array(z.string()).default([]),
    environmentVariables: z.record(z.string(), z.string()).default({}),
    permissionMode: z.string().default('default'),
    collaborationMode: z.string().default('default'),
})

const profileSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    config: profileConfigSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
})

/** Sanitize profile ID to prevent path traversal */
function sanitizeId(id: string): string | null {
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) {
        return null
    }
    const sanitized = id.replace(/[^a-zA-Z0-9_\-]/g, '')
    return sanitized.length > 0 ? sanitized : null
}

function ensureProfilesDir(): void {
    if (!existsSync(PROFILES_DIR)) {
        mkdirSync(PROFILES_DIR, { recursive: true })
    }
}

export function createProfileRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    // GET /profiles — list all profiles
    app.get('/profiles', (c) => {
        try {
            ensureProfilesDir()
            const files = readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json'))
            const profiles = []

            for (const file of files) {
                try {
                    const raw = readFileSync(join(PROFILES_DIR, file), 'utf-8')
                    const parsed = JSON.parse(raw)
                    const result = profileSchema.safeParse(parsed)
                    if (result.success) {
                        profiles.push(result.data)
                    }
                } catch {
                    // Skip invalid files
                }
            }

            profiles.sort((a, b) => a.name.localeCompare(b.name))
            return c.json(profiles)
        } catch (error) {
            console.error('[Profiles] Error listing profiles:', error)
            return c.json([], 200)
        }
    })

    // PUT /profiles/:id — create or update a profile
    app.put('/profiles/:id', async (c) => {
        const id = sanitizeId(c.req.param('id'))
        if (!id) {
            return c.json({ error: 'Invalid profile ID' }, 400)
        }

        const json = await c.req.json().catch(() => null)
        if (!json) {
            return c.json({ error: 'Invalid request body' }, 400)
        }

        const result = profileSchema.safeParse({ ...json, id })
        if (!result.success) {
            return c.json({ error: 'Invalid profile data', details: result.error.flatten() }, 400)
        }

        try {
            ensureProfilesDir()
            const filePath = join(PROFILES_DIR, `${id}.json`)
            writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8')
            return c.json({ ok: true })
        } catch (error) {
            console.error('[Profiles] Error saving profile:', error)
            return c.json({ error: 'Failed to save profile' }, 500)
        }
    })

    // DELETE /profiles/:id — delete a profile
    app.delete('/profiles/:id', (c) => {
        const id = sanitizeId(c.req.param('id'))
        if (!id) {
            return c.json({ error: 'Invalid profile ID' }, 400)
        }

        try {
            const filePath = join(PROFILES_DIR, `${id}.json`)
            if (existsSync(filePath)) {
                unlinkSync(filePath)
            }
            return c.json({ ok: true })
        } catch (error) {
            console.error('[Profiles] Error deleting profile:', error)
            return c.json({ error: 'Failed to delete profile' }, 500)
        }
    })

    return app
}
