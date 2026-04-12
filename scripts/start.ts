/**
 * HAPI production-like launcher — hub + runner from source
 *
 * Usage:
 *   bun run start                              # Direct
 *   pm2 start bun --name hapi --time -- run start   # PM2
 *   pm2 restart hapi
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')
const hubDir = join(repoRoot, 'hub')
const cliDir = join(repoRoot, 'cli')
const port = process.env.HAPI_LISTEN_PORT ?? '3006'

const children: ChildProcess[] = []

// Cleanup all children on exit
const cleanup = () => {
    console.log('[hapi] shutting down...')
    for (const child of children) {
        try { child.kill('SIGTERM') } catch {}
    }
    setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Start hub
const hub = spawn('bun', ['run', 'src/index.ts'], {
    cwd: hubDir,
    stdio: 'inherit',
    env: process.env,
})
children.push(hub)
hub.on('exit', (code) => {
    console.log(`[hapi] hub exited (code ${code}), shutting down...`)
    cleanup()
})

// Wait for hub to be ready, then start runner
async function waitForHub(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await fetch(`http://127.0.0.1:${port}/`)
            return
        } catch {}
        await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error('Hub did not start in time')
}

await waitForHub()
console.log(`[hapi] hub ready on port ${port}`)

// Start runner (cwd must be cli/ for @/* path alias resolution)
const runner = spawn('bun', ['src/index.ts', 'runner', 'start-sync'], {
    cwd: cliDir,
    stdio: 'inherit',
    env: process.env,
})
children.push(runner)
runner.on('exit', (code) => {
    console.log(`[hapi] runner exited (code ${code}), shutting down...`)
    cleanup()
})

console.log('[hapi] all services running')
