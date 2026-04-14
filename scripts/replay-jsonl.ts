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

// Parse --bg-tasks flag
const bgTasksArgIdx = process.argv.indexOf('--bg-tasks')
const bgTasksCount: number = bgTasksArgIdx >= 0
    ? parseInt(process.argv[bgTasksArgIdx + 1], 10) || 0
    : 0

const filePath = process.argv[2]
if (!filePath) {
    console.error('Usage: bun run scripts/replay-jsonl.ts <path> [--port PORT] [--bg-tasks N]')
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
// Extract todos from messages (last TodoWrite wins, same as hub)
let lastTodos: unknown[] | null = null
for (const msg of messages) {
    const content = msg.content as Record<string, unknown>
    if (content.role !== 'agent') continue
    const inner = content.content as Record<string, unknown> | undefined
    if (!inner || inner.type !== 'output') continue
    const data = inner.data as Record<string, unknown> | undefined
    if (!data || data.type !== 'assistant') continue
    const message = data.message as Record<string, unknown> | undefined
    if (!message) continue
    const mc = message.content
    if (!Array.isArray(mc)) continue
    for (const block of mc) {
        if ((block as Record<string, unknown>).type === 'tool_use' && (block as Record<string, unknown>).name === 'TodoWrite') {
            const input = (block as Record<string, unknown>).input as Record<string, unknown> | undefined
            if (input && Array.isArray(input.todos)) {
                lastTodos = input.todos as unknown[]
            }
        }
    }
}
if (lastTodos) {
    db.prepare('UPDATE sessions SET todos = ? WHERE id = ?').run(JSON.stringify(lastTodos), sessionId)
    const completed = lastTodos.filter((t: any) => t.status === 'completed').length
    console.log(`Set todos: ${completed}/${lastTodos.length} completed`)
}

db.close()
console.log(`Inserted ${messages.length} messages`)

// Inject background task signals via Socket.IO if requested
if (bgTasksCount > 0) {
    console.log(`\nInjecting ${bgTasksCount} background task(s) via Socket.IO...`)
    const { io } = await import('socket.io-client')
    const socket = io(`${hubBase}/cli`, {
        auth: { token: cliToken, sessionId, machineId: REPLAY_MACHINE_ID },
        transports: ['websocket'],
    })
    await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve)
        socket.on('connect_error', reject)
        setTimeout(() => reject(new Error('Socket.IO connect timeout')), 5000)
    })

    // Emit session-alive to register the session as active
    socket.emit('session-alive', { sid: sessionId, time: Date.now(), thinking: false })
    await new Promise(r => setTimeout(r, 200))

    // Sample background tasks: mix of agents and shells with realistic data
    const sampleTasks = [
        // Agents
        {
            toolName: 'Agent',
            toolUseId: `toolu_agent_${randomUUID().slice(0, 8)}`,
            input: {
                description: 'Explore Hub architecture and routing',
                prompt: 'You are a system architecture analyst. Examine the hub/src directory structure and report on the routing, middleware, and Socket.IO handler patterns.',
                subagent_type: 'Explore',
                run_in_background: true,
            },
            resultText: (id: string) => `Async agent launched successfully.\nagentId: ${id} (internal ID - do not mention to user. Use SendMessage with the agent's name to communicate.)`,
        },
        {
            toolName: 'Agent',
            toolUseId: `toolu_agent_${randomUUID().slice(0, 8)}`,
            input: {
                description: 'Analyze CLI command structure',
                prompt: 'Analyze the CLI package structure, commands, and how they interact with the hub via Socket.IO.',
                subagent_type: 'general-purpose',
                run_in_background: true,
            },
            resultText: (id: string) => `Async agent launched successfully.\nagentId: ${id} (internal ID)`,
        },
        // Shells
        {
            toolName: 'Bash',
            toolUseId: `toolu_bash_${randomUUID().slice(0, 8)}`,
            input: {
                command: 'find . -name "*.ts" -not -path "*/node_modules/*" | head -200 | while read f; do wc -l "$f"; done',
                description: 'Count lines in TypeScript files',
                run_in_background: true,
            },
            resultText: (id: string) => `Command running in background with ID: ${id}. Output is being written to: /tmp/bg-${id}.output`,
        },
        {
            toolName: 'Bash',
            toolUseId: `toolu_bash_${randomUUID().slice(0, 8)}`,
            input: {
                command: 'for dir in cli hub web shared; do echo "=== $dir ===" && find "$dir/src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | while read f; do grep -c "import" "$f"; done; done',
                description: 'Analyze imports per package',
                run_in_background: true,
            },
            resultText: (id: string) => `Command running in background with ID: ${id}. Output is being written to: /tmp/bg-${id}.output`,
        },
    ]

    const tasksToInject = sampleTasks.slice(0, bgTasksCount)

    for (let i = 0; i < tasksToInject.length; i++) {
        const task = tasksToInject[i]
        const taskId = `bg-${task.toolName.toLowerCase()}-${i + 1}`

        // Phase 1: Send assistant message with tool_use (for tracker to extract pending info)
        const assistantMessage = {
            role: 'agent',
            content: {
                type: 'output',
                data: {
                    type: 'assistant',
                    message: {
                        role: 'assistant',
                        content: [{
                            type: 'tool_use',
                            id: task.toolUseId,
                            name: task.toolName,
                            input: task.input,
                        }]
                    }
                }
            }
        }
        socket.emit('message', { sid: sessionId, message: JSON.stringify(assistantMessage) })

        // Phase 2: Send tool_result (triggers task start in tracker)
        const toolResultMessage = {
            role: 'agent',
            content: {
                type: 'output',
                data: {
                    type: 'user',
                    message: {
                        role: 'user',
                        content: [{
                            type: 'tool_result',
                            tool_use_id: task.toolUseId,
                            content: task.resultText(taskId),
                        }]
                    }
                }
            }
        }
        socket.emit('message', { sid: sessionId, message: JSON.stringify(toolResultMessage) })
    }

    await new Promise(r => setTimeout(r, 500))
    console.log(`Injected ${tasksToInject.length} background task(s): ${tasksToInject.filter(t => t.toolName === 'Agent').length} agents, ${tasksToInject.filter(t => t.toolName === 'Bash').length} shells`)
    socket.disconnect()
}

const jwt = await getWebJwt()
console.log('\n--- Ready ---')
console.log(`Web URL:  ${hubBase}/sessions/${sessionId}`)
console.log(`API:      curl -s '${hubBase}/api/sessions/${sessionId}/messages?limit=5' -H 'Authorization: Bearer ${jwt}' | python3 -m json.tool | head -30`)
