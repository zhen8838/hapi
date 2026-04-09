import { beforeEach, describe, expect, it } from 'vitest'
import {
    loadPreferredAgent,
    loadPreferredYoloMode,
    loadSelectedSessionProfileId,
    loadSessionProfiles,
    savePreferredAgent,
    savePreferredYoloMode,
    saveSelectedSessionProfileId,
    saveSessionProfiles,
    type SessionProfile,
} from './preferences'

describe('NewSession preferences', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('loads defaults when storage is empty', () => {
        expect(loadPreferredAgent()).toBe('claude')
        expect(loadPreferredYoloMode()).toBe(false)
    })

    it('loads saved values from storage', () => {
        localStorage.setItem('hapi:newSession:agent', 'codex')
        localStorage.setItem('hapi:newSession:yolo', 'true')

        expect(loadPreferredAgent()).toBe('codex')
        expect(loadPreferredYoloMode()).toBe(true)
    })

    it('falls back to default agent on invalid stored value', () => {
        localStorage.setItem('hapi:newSession:agent', 'unknown-agent')

        expect(loadPreferredAgent()).toBe('claude')
    })

    it('persists new values to storage', () => {
        savePreferredAgent('gemini')
        savePreferredYoloMode(true)

        expect(localStorage.getItem('hapi:newSession:agent')).toBe('gemini')
        expect(localStorage.getItem('hapi:newSession:yolo')).toBe('true')
    })

    it('loads no session profiles by default', () => {
        expect(loadSessionProfiles()).toEqual([])
        expect(loadSelectedSessionProfileId()).toBeNull()
    })

    it('persists and loads session profiles', () => {
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
                },
                createdAt: 1,
                updatedAt: 2,
            },
        ]

        saveSessionProfiles(profiles)
        saveSelectedSessionProfileId('profile-2')

        expect(loadSessionProfiles()).toEqual([
            profiles[1],
            profiles[0],
        ])
        expect(loadSelectedSessionProfileId()).toBe('profile-2')
    })

    it('drops invalid session profiles from storage', () => {
        localStorage.setItem('hapi:newSession:profiles', JSON.stringify([
            { id: 'ok', name: 'Ok', config: { agent: 'claude', model: 'auto', effort: 'auto', modelReasoningEffort: 'default', yoloMode: false, sessionType: 'simple', worktreeName: '', additionalParameters: ['--plugin-dir'] } },
            { id: 'bad-agent', name: 'Bad', config: { agent: 'nope' } },
            { id: '', name: 'Missing id', config: { agent: 'claude' } },
        ]))

        expect(loadSessionProfiles()).toEqual([
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
                },
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
            },
        ])
    })

    it('clears selected profile id', () => {
        saveSelectedSessionProfileId('profile-1')
        saveSelectedSessionProfileId(null)

        expect(loadSelectedSessionProfileId()).toBeNull()
        expect(localStorage.getItem('hapi:newSession:selectedProfileId')).toBeNull()
    })
})
