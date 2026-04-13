import { describe, expect, it } from 'vitest'
import { reduceTimeline } from './reducerTimeline'
import type { TracedMessage } from './tracer'

function makeContext() {
    return {
        permissionsById: new Map(),
        groups: new Map(),
        consumedGroupIds: new Set<string>(),
        titleChangesByToolUseId: new Map(),
        emittedTitleChangeToolUseIds: new Set<string>()
    }
}

function makeUserMessage(text: string, overrides?: Partial<TracedMessage>): TracedMessage {
    return {
        id: 'msg-1',
        localId: null,
        createdAt: 1_700_000_000_000,
        role: 'user',
        content: { type: 'text', text },
        isSidechain: false,
        ...overrides
    } as TracedMessage
}

function makeAgentMessage(text: string, overrides?: Partial<TracedMessage>): TracedMessage {
    return {
        id: 'msg-agent-1',
        localId: null,
        createdAt: 1_700_000_000_000,
        role: 'agent',
        content: [{ type: 'text', text, uuid: 'u-1', parentUUID: null }],
        isSidechain: false,
        ...overrides
    } as TracedMessage
}

describe('reduceTimeline', () => {
    it('renders user text as user-text block', () => {
        const text = 'Hello, this is a normal message'
        const { blocks } = reduceTimeline([makeUserMessage(text)], makeContext())

        expect(blocks).toHaveLength(1)
        expect(blocks[0].kind).toBe('user-text')
    })

    it('does not filter XML-like user text (filtering is in normalize layer)', () => {
        const text = '<task-notification> <summary>Some task</summary> </task-notification>'
        const { blocks } = reduceTimeline([makeUserMessage(text)], makeContext())

        expect(blocks).toHaveLength(1)
        expect(blocks[0].kind).toBe('user-text')
    })

    it('suppresses "No response requested." when parentUUID points to an injected turn', () => {
        // Simulate: sidechain message with uuid 'injected-uuid', then sentinel reply pointing to it
        const injectedMsg: TracedMessage = {
            id: 'msg-injected',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'sidechain', uuid: 'injected-uuid', prompt: '<task-notification>...</task-notification>' }],
            isSidechain: true
        } as TracedMessage

        const sentinelMsg: TracedMessage = {
            id: 'msg-sentinel',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'text', text: 'No response requested.', uuid: 'u-1', parentUUID: 'injected-uuid' }],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([injectedMsg, sentinelMsg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(0)
    })

    it('keeps "No response requested." when parentUUID points to a normal turn (not injected)', () => {
        // parentUUID points to a normal assistant message, not an injected turn
        const normalMsg: TracedMessage = {
            id: 'msg-normal',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'text', text: 'Hello!', uuid: 'normal-uuid', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const replyMsg: TracedMessage = {
            id: 'msg-reply',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'text', text: 'No response requested.', uuid: 'u-2', parentUUID: 'normal-uuid' }],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([normalMsg, replyMsg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        // Should be 2: "Hello!" + "No response requested." (not filtered because parent is normal)
        expect(textBlocks).toHaveLength(2)
    })

    it('keeps "No response requested." when parentUUID is null (first message)', () => {
        const { blocks } = reduceTimeline([makeAgentMessage('No response requested.')], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('keeps "No response requested." when message also has other blocks (e.g. tool calls)', () => {
        const injectedMsg: TracedMessage = {
            id: 'msg-injected',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'sidechain', uuid: 'injected-uuid', prompt: 'system content' }],
            isSidechain: true
        } as TracedMessage

        const multiMsg: TracedMessage = {
            id: 'msg-multi',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [
                { type: 'text', text: 'No response requested.', uuid: 'u-1', parentUUID: 'injected-uuid' },
                { type: 'tool-call', id: 'tc-1', name: 'Bash', input: { command: 'ls' }, description: null, uuid: 'u-1', parentUUID: 'injected-uuid' }
            ],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([injectedMsg, multiMsg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('keeps normal assistant text blocks', () => {
        const { blocks } = reduceTimeline([makeAgentMessage('Here is the answer.')], makeContext())

        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('extracts task-notification summary as event from sidechain block', () => {
        const msg: TracedMessage = {
            id: 'msg-notif',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'sidechain', uuid: 'n-1', prompt: '<task-notification> <summary>Background command stopped</summary> </task-notification>' }],
            isSidechain: true
        } as TracedMessage

        const { blocks } = reduceTimeline([msg], makeContext())
        const events = blocks.filter(b => b.kind === 'agent-event')
        expect(events).toHaveLength(1)
        expect((events[0] as any).event.message).toBe('Background command stopped')
    })

    it('folds Skill expansion text into the Skill tool card result', () => {
        const skillExpansionText = '# Simplify: Code Review and Cleanup\n\nReview all changed files...'

        const toolCallMsg: TracedMessage = {
            id: 'msg-tc',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'tool-call', id: 'tc-skill', name: 'Skill', input: { skill: 'simplify' }, description: null, uuid: 'u-tc', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const toolResultMsg: TracedMessage = {
            id: 'msg-tr',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'tool-result', tool_use_id: 'tc-skill', content: 'Launching skill: simplify', is_error: false, uuid: 'u-tr', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const expansionMsg: TracedMessage = {
            id: 'msg-expand',
            localId: null,
            createdAt: 1_700_000_002_000,
            role: 'user',
            content: { type: 'text', text: skillExpansionText },
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline(
            [toolCallMsg, toolResultMsg, expansionMsg],
            makeContext()
        )

        // No user-text block for the expansion
        const userBlocks = blocks.filter(b => b.kind === 'user-text')
        expect(userBlocks).toHaveLength(0)

        // The Skill tool card should exist and its result should be the expansion text
        const toolBlocks = blocks.filter(b => b.kind === 'tool-call')
        expect(toolBlocks).toHaveLength(1)
        expect(toolBlocks[0].kind === 'tool-call' && toolBlocks[0].tool.name).toBe('Skill')
        expect(toolBlocks[0].kind === 'tool-call' && toolBlocks[0].tool.result).toBe(skillExpansionText)
    })

    it('does not suppress user text after non-Skill tool results', () => {
        const toolCallMsg: TracedMessage = {
            id: 'msg-tc',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'tool-call', id: 'tc-bash', name: 'Bash', input: { command: 'ls' }, description: null, uuid: 'u-tc', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const toolResultMsg: TracedMessage = {
            id: 'msg-tr',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'tool-result', tool_use_id: 'tc-bash', content: 'file.txt', is_error: false, uuid: 'u-tr', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const userMsg = makeUserMessage('Thanks!', { id: 'msg-user', createdAt: 1_700_000_002_000 })

        const { blocks } = reduceTimeline(
            [toolCallMsg, toolResultMsg, userMsg],
            makeContext()
        )

        const userBlocks = blocks.filter(b => b.kind === 'user-text')
        expect(userBlocks).toHaveLength(1)
    })

    it('handles Skill tool call without subsequent user text', () => {
        const toolCallMsg: TracedMessage = {
            id: 'msg-tc',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'tool-call', id: 'tc-skill', name: 'Skill', input: { skill: 'simplify' }, description: null, uuid: 'u-tc', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const toolResultMsg: TracedMessage = {
            id: 'msg-tr',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'tool-result', tool_use_id: 'tc-skill', content: 'Launching skill: simplify', is_error: false, uuid: 'u-tr', parentUUID: null }],
            isSidechain: false
        } as TracedMessage

        const agentMsg = makeAgentMessage('I will now review the code.', { id: 'msg-agent', createdAt: 1_700_000_002_000 })

        const { blocks } = reduceTimeline(
            [toolCallMsg, toolResultMsg, agentMsg],
            makeContext()
        )

        // Skill tool card keeps original result
        const toolBlocks = blocks.filter(b => b.kind === 'tool-call')
        expect(toolBlocks).toHaveLength(1)
        expect(toolBlocks[0].kind === 'tool-call' && toolBlocks[0].tool.result).toBe('Launching skill: simplify')

        // Agent text is still rendered
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('suppresses sentinel reply to task-notification (summary path)', () => {
        const notifMsg: TracedMessage = {
            id: 'msg-notif',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'sidechain', uuid: 'notif-uuid', prompt: '<task-notification> <summary>Done</summary> </task-notification>' }],
            isSidechain: true
        } as TracedMessage

        const sentinelMsg: TracedMessage = {
            id: 'msg-sentinel',
            localId: null,
            createdAt: 1_700_000_001_000,
            role: 'agent',
            content: [{ type: 'text', text: 'No response requested.', uuid: 'u-1', parentUUID: 'notif-uuid' }],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([notifMsg, sentinelMsg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(0)
        // But the event should still be present
        const events = blocks.filter(b => b.kind === 'agent-event')
        expect(events).toHaveLength(1)
    })
})
