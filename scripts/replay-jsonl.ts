/**
 * Message Replay Tool — injects messages into a Hub session for visual review.
 *
 * Supports two input formats:
 *   1. Raw JSONL (Claude Code session log) — wraps in CLI envelope
 *   2. Hub fixture JSON (array of {id, content, ...}) — already enveloped
 *
 * Usage:
 *   bun run scripts/replay-jsonl.ts <path-to-file> [--port 3007]
 *
 * Environment overrides:
 *   HAPI_HOME          — default: ~/.hapi
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPLAY_SESSION_TAG = '__replay_test__'
const REPLAY_SESSION_PATH = '/tmp/replay-test'
const REPLAY_MACHINE_ID = 'test-virtual-machine'

const hapiHome = process.env.HAPI_HOME ?? join(process.env.HOME!, '.hapi')
const settingsPath = join(hapiHome, 'settings.json')
const dbPath = join(hapiHome, 'hapi.db')

const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
const cliToken: string = settings.cliApiToken

// Parse --port flag, default to settings or 3006
const portArgIdx = process.argv.indexOf('--port')
const port: number = portArgIdx >= 0
    ? parseInt(process.argv[portArgIdx + 1], 10)
    : (settings.listenPort ?? 3006)
const hubBase = `http://127.0.0.1:${port}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hubCli(path: string, body?: unknown) {
    const res = await fetch(`${hubBase}/cli${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Authorization': `Bearer ${cliToken}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        throw new Error(`CLI ${path}: ${res.status} ${await res.text()}`)
    }
    return res.json()
}

async function getWebJwt(): Promise<string> {
    const res = await fetch(`${hubBase}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: cliToken }),
    })
    if (!res.ok) {
        throw new Error(`Auth failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json() as { token: string }
    return data.token
}

// ---------------------------------------------------------------------------
// JSONL mode helpers (raw Claude Code log)
// ---------------------------------------------------------------------------

const VISIBLE_SYSTEM_SUBTYPES = new Set([
    'api_error', 'turn_duration', 'microcompact_boundary', 'compact_boundary',
])

function shouldSkipJsonlLine(line: Record<string, unknown>): boolean {
    if (line.isMeta === true) return true
    if (line.isCompactSummary === true) return true
    if (line.type === 'system') {
        const subtype = line.subtype as string | undefined
        if (!subtype || !VISIBLE_SYSTEM_SUBTYPES.has(subtype)) return true
    }
    if (line.type === 'rate_limit_event') return true
    return false
}

const SYSTEM_INJECTION_PREFIXES = [
    '<task-notification', '<tool-invocation-permission', '<system-reminder',
    '<stop-hook-summary', '<denied-tool-feedback', '<pre-tool-response', '<command-name',
]

function isExternalUserMessage(line: Record<string, unknown>): boolean {
    if (line.type !== 'user') return false
    if (line.isSidechain === true) return false
    if (line.isMeta === true) return false
    const message = line.message as Record<string, unknown> | undefined
    if (!message) return false
    const content = message.content
    if (typeof content !== 'string') return false
    const trimmed = content.trimStart()
    for (const prefix of SYSTEM_INJECTION_PREFIXES) {
        if (trimmed.startsWith(prefix)) return false
    }
    return true
}

function wrapInCliEnvelope(line: Record<string, unknown>): Record<string, unknown> {
    if (isExternalUserMessage(line)) {
        const message = line.message as Record<string, unknown>
        return {
            role: 'user',
            content: { type: 'text', text: message.content },
            meta: { sentFrom: 'cli' },
        }
    }
    return {
        role: 'agent',
        content: { type: 'output', data: line },
        meta: { sentFrom: 'cli' },
    }
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

type MessageRow = { content: unknown; created_at?: number }

function parseInput(filePath: string): MessageRow[] {
    const raw = readFileSync(filePath, 'utf-8').trim()

    // Hub fixture format: JSON array of {id, content, created_at, seq, ...}
    if (raw.startsWith('[')) {
        const rows = JSON.parse(raw) as Array<Record<string, unknown>>
        return rows.map((row) => {
            const content = typeof row.content === 'string'
                ? JSON.parse(row.content)
                : row.content
            return { content, created_at: row.created_at as number | undefined }
        })
    }

    // Raw JSONL format: one JSON object per line
    const messages: MessageRow[] = []
    let skipped = 0
    for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
            const obj = JSON.parse(trimmed) as Record<string, unknown>
            if (shouldSkipJsonlLine(obj)) { skipped++; continue }
            messages.push({ content: wrapInCliEnvelope(obj) })
        } catch {
            skipped++
        }
    }
    if (skipped > 0) console.log(`  (skipped ${skipped} JSONL lines)`)
    return messages
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const filePath = process.argv[2]
if (!filePath) {
    console.error('Usage: bun run scripts/replay-jsonl.ts <path> [--port PORT]')
    process.exit(1)
}

console.log(`Reading ${filePath}...`)
const messages = parseInput(filePath)
console.log(`Loaded ${messages.length} messages`)

console.log(`Target hub: ${hubBase}`)

// Create machine
console.log(`Creating/loading machine "${REPLAY_MACHINE_ID}"...`)
await hubCli('/machines', {
    id: REPLAY_MACHINE_ID,
    metadata: { hostname: 'TestVirtualMachine', os: 'linux' },
})

console.log(`Creating/loading session "${REPLAY_SESSION_TAG}"...`)
const sessionRes = await hubCli('/sessions', {
    tag: REPLAY_SESSION_TAG,
    metadata: { path: REPLAY_SESSION_PATH, host: 'TestVirtualMachine', flavor: 'claude', machineId: REPLAY_MACHINE_ID },
}) as { session: { id: string } }
const sessionId = sessionRes.session.id
console.log(`Session ID: ${sessionId}`)

console.log('Clearing previous replay messages...')
const db = new Database(dbPath)
db.exec(`DELETE FROM messages WHERE session_id = '${sessionId}'`)

console.log('Inserting messages...')
const insertStmt = db.prepare(
    'INSERT INTO messages (id, session_id, content, created_at, seq, local_id) VALUES (?, ?, ?, ?, ?, ?)'
)
const baseTime = Date.now()
for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    insertStmt.run(
        randomUUID(),
        sessionId,
        JSON.stringify(msg.content),
        msg.created_at ?? (baseTime + i),
        i + 1,
        null,
    )
}
db.close()
console.log(`Inserted ${messages.length} messages`)

const jwt = await getWebJwt()
console.log('\n--- Ready ---')
console.log(`Web URL:  ${hubBase}/sessions/${sessionId}`)
console.log(`API:      curl -s '${hubBase}/api/sessions/${sessionId}/messages?limit=5' -H 'Authorization: Bearer ${jwt}' | python3 -m json.tool | head -30`)
