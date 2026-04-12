import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { mkdirSync, rmSync, readFileSync, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'

function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer()
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address()
            if (addr && typeof addr === 'object') {
                const port = addr.port
                server.close(() => resolve(port))
            } else {
                reject(new Error('Failed to get port'))
            }
        })
        server.on('error', reject)
    })
}

const port = process.env.HAPI_LISTEN_PORT
    ? Number(process.env.HAPI_LISTEN_PORT)
    : await findFreePort()

// Use HAPI_HOME if set (persistent mode), otherwise use isolated temp directory
const ispersistent = Boolean(process.env.HAPI_HOME)
const previewHome = process.env.HAPI_HOME ?? join(tmpdir(), `hapi-preview-${port}`)
mkdirSync(previewHome, { recursive: true })

const repoRoot = join(import.meta.dir, '..')
const hubDir = join(repoRoot, 'hub')
const cliDir = join(repoRoot, 'cli')

// Log file for debugging
const logFile = join(previewHome, 'preview.log')

// Shared env: hub and CLI use the same HAPI_HOME so they share the auto-generated cliApiToken
const sharedEnv = {
    ...process.env,
    HAPI_HOME: previewHome,
    HAPI_LISTEN_PORT: String(port),
    HAPI_LISTEN_HOST: '0.0.0.0',
    DEBUG: 'hapi:*',
}

console.log(``)
console.log(`  HAPI Preview`)
console.log(`  ─────────────────────────────`)
console.log(`  URL:       http://127.0.0.1:${port}`)
console.log(`  HAPI_HOME: ${previewHome}`)
console.log(`  Log:       ${logFile}`)
console.log(`  Press Ctrl+C to stop`)
console.log(``)

const children: ChildProcess[] = []
const logStream = createWriteStream(logFile, { flags: 'a' })

// Step 1: Start hub (generates cliApiToken in HAPI_HOME/settings.json)
const hub = spawn('bun', ['run', 'src/index.ts'], {
    cwd: hubDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: sharedEnv,
})
hub.stdout?.pipe(logStream, { end: false })
hub.stderr?.pipe(logStream, { end: false })
// Also print key hub lines to console
hub.stdout?.on('data', (data: Buffer) => {
    const line = data.toString()
    if (/listening|ready|error/i.test(line)) process.stdout.write(line)
})
hub.stderr?.on('data', (data: Buffer) => {
    const line = data.toString()
    if (/error|warn/i.test(line)) process.stderr.write(line)
})
children.push(hub)

// Step 2: Wait for hub to be ready
async function waitForHub(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/health`)
            if (res.ok) return
        } catch {}
        await new Promise(r => setTimeout(r, 500))
    }
    throw new Error('Hub did not become ready in time')
}

// Step 3: After hub is up, print token and start CLI runner
waitForHub().then(() => {
    // Read the auto-generated token from settings.json
    try {
        const settings = JSON.parse(readFileSync(join(previewHome, 'settings.json'), 'utf-8'))
        console.log(`  ─────────────────────────────`)
        console.log(`  Hub ready!`)
        console.log(`  URL:       http://127.0.0.1:${port}`)
        console.log(`  Token:     ${settings.cliApiToken}`)
        console.log(`  ─────────────────────────────\n`)
    } catch {
        console.log(`  Hub ready. (Could not read token from settings.json)\n`)
    }

    const runner = spawn('bun', ['run', 'src/index.ts', 'runner', 'start-sync'], {
        cwd: cliDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...sharedEnv,
            // CLI connects to our preview hub, not the default localhost:3006
            HAPI_API_URL: `http://127.0.0.1:${port}`,
        },
    })
    runner.stdout?.pipe(logStream, { end: false })
    runner.stderr?.pipe(logStream, { end: false })
    children.push(runner)
}).catch(err => {
    console.error(`  Failed to start runner: ${err.message}`)
})

// Cleanup
const cleanup = () => {
    for (const child of children) {
        try { child.kill('SIGTERM') } catch {}
    }
    setTimeout(() => {
        if (!ispersistent) {
            try { rmSync(previewHome, { recursive: true, force: true }) } catch {}
        }
        process.exit(0)
    }, 500)
}

hub.on('exit', (code) => {
    for (const child of children) {
        if (child !== hub) try { child.kill('SIGTERM') } catch {}
    }
    if (!ispersistent) {
        try { rmSync(previewHome, { recursive: true, force: true }) } catch {}
    }
    process.exit(code ?? 0)
})

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
