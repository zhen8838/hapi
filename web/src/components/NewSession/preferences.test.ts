import { beforeEach, describe, expect, it } from 'vitest'
import {
    loadLegacySessionProfiles,
    clearLegacyStorage,
    hasLegacyData,
    LEGACY_STORAGE_KEYS,
    type SessionProfile,
} from './preferences'

describe('NewSession preferences', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('reports no legacy data when storage is empty', () => {
        expect(hasLegacyData()).toBe(false)
    })

    it('loads no legacy profiles by default', () => {
        expect(loadLegacySessionProfiles()).toEqual([])
    })

    it('loads legacy profiles from storage', () => {
        const profiles: SessionProfile[] = [
            {
                id: 'profile-2',
                name: 'Z Claude',
                config: {
                    agent: 'claude',
                    model: 'sonnet',
                    effort: 'high',
                    modelReasoningEffort: 'default',
                    yoloMode: true,
                    sessionType: 'simple',
                    worktreeName: '',
                    additionalParameters: ['--plugin-dir', '/tmp/plugin-b'],
                    environmentVariables: { ANTHROPIC_BASE_URL: 'https://example.com' },
                    permissionMode: 'default',
                    collaborationMode: 'default',
                },
                createdAt: 2,
                updatedAt: 3,
            },
            {
                id: 'profile-1',
                name: 'A Codex',
                config: {
                    agent: 'codex',
                    model: 'gpt-5.4',
                    effort: 'auto',
                    modelReasoningEffort: 'high',
                    yoloMode: false,
                    sessionType: 'worktree',
                    worktreeName: 'feature-a',
                    additionalParameters: [],
                    environmentVariables: {},
                    permissionMode: 'default',
                    collaborationMode: 'default',
                },
                createdAt: 1,
                updatedAt: 2,
            },
        ]

        localStorage.setItem('hapi:newSession:profiles', JSON.stringify(profiles))
        expect(hasLegacyData()).toBe(true)

        expect(loadLegacySessionProfiles()).toEqual([
            profiles[1],
            profiles[0],
        ])
    })

    it('drops invalid legacy profiles from storage', () => {
        localStorage.setItem('hapi:newSession:profiles', JSON.stringify([
            { id: 'ok', name: 'Ok', config: { agent: 'claude', model: 'auto', effort: 'auto', modelReasoningEffort: 'default', yoloMode: false, sessionType: 'simple', worktreeName: '', additionalParameters: ['--plugin-dir'] } },
            { id: 'bad-agent', name: 'Bad', config: { agent: 'nope' } },
            { id: '', name: 'Missing id', config: { agent: 'claude' } },
        ]))

        expect(loadLegacySessionProfiles()).toEqual([
            {
                id: 'ok',
                name: 'Ok',
                config: {
                    agent: 'claude',
                    model: 'auto',
                    effort: 'auto',
                    modelReasoningEffort: 'default',
                    yoloMode: false,
                    sessionType: 'simple',
                    worktreeName: '',
                    additionalParameters: ['--plugin-dir'],
                    environmentVariables: {},
                    permissionMode: 'default',
                    collaborationMode: 'default',
                },
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
            },
        ])
    })

    it('clears all legacy storage keys', () => {
        localStorage.setItem('hapi:newSession:profiles', '[]')
        localStorage.setItem('hapi:newSession:selectedProfileId', 'test')
        localStorage.setItem('hapi:newSession:agent', 'claude')
        localStorage.setItem('hapi:newSession:yolo', 'false')

        clearLegacyStorage()

        for (const key of LEGACY_STORAGE_KEYS) {
            expect(localStorage.getItem(key)).toBeNull()
        }
    })
})
