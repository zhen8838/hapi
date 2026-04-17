import { describe, expect, it } from 'bun:test'
import { SyncEngine } from './syncEngine'

describe('SyncEngine.persistSessionConfig', () => {
    it('delegates to sessionCache.applySessionConfig without calling rpcGateway', async () => {
        const applyCalls: Array<[string, unknown]> = []
        const rpcCalls: Array<[string, unknown]> = []

        const fakeCache = {
            applySessionConfig: (sessionId: string, config: unknown) => {
                applyCalls.push([sessionId, config])
            }
        }
        const fakeRpc = {
            requestSessionConfig: async (sessionId: string, config: unknown) => {
                rpcCalls.push([sessionId, config])
                return { applied: config }
            }
        }

        // Construct a minimal engine using Object.create to bypass the real constructor,
        // then inject the two collaborators the method under test uses.
        const engine = Object.create(SyncEngine.prototype) as SyncEngine
        // @ts-expect-error - intentionally assigning to private for unit test
        engine.sessionCache = fakeCache
        // @ts-expect-error - intentionally assigning to private for unit test
        engine.rpcGateway = fakeRpc

        await engine.persistSessionConfig('session-1', { model: 'gpt-5.4' })

        expect(applyCalls).toEqual([['session-1', { model: 'gpt-5.4' }]])
        expect(rpcCalls).toEqual([])
    })
})
