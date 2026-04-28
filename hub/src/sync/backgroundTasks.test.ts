import { describe, it, expect } from 'vitest'
import { BackgroundTaskTracker, extractBackgroundTaskDelta } from './backgroundTasks'

function wrap(data: unknown) {
    return { role: 'agent', content: { type: 'output', data } }
}

function assistantWithToolUse(toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>) {
    return wrap({
        type: 'assistant',
        message: { role: 'assistant', content: toolUses.map(t => ({ type: 'tool_use', ...t })) }
    })
}

function userWithToolResult(results: Array<{ tool_use_id: string; content: string }>) {
    return wrap({
        type: 'user',
        message: { role: 'user', content: results.map(r => ({ type: 'tool_result', ...r })) }
    })
}

function taskNotification(taskId: string, summary: string) {
    return wrap({
        type: 'user',
        message: { role: 'user', content: `<task-notification>\n<task-id>${taskId}</task-id>\n<summary>${summary}</summary>\n<status>completed</status>\n</task-notification>` }
    })
}

function event(data: unknown) {
    return { role: 'agent', content: { type: 'event', data } }
}

describe('BackgroundTaskTracker', () => {
    it('tracks a Bash background task through full lifecycle', () => {
        const tracker = new BackgroundTaskTracker()

        // Phase 1: assistant message with Bash tool_use
        const r1 = tracker.processMessage(assistantWithToolUse([{
            id: 'toolu_bash_1',
            name: 'Bash',
            input: { command: 'find . -name "*.ts" | wc -l', run_in_background: true, description: 'Count TS files' }
        }]))
        expect(r1).toBeNull() // No events yet, just pending

        // Phase 2: tool_result with background ID
        const r2 = tracker.processMessage(userWithToolResult([{
            tool_use_id: 'toolu_bash_1',
            content: 'Command running in background with ID: bg-123. Output is being written to: /tmp/bg-123.output'
        }]))
        expect(r2).not.toBeNull()
        expect(r2!.started).toHaveLength(1)
        expect(r2!.started[0].id).toBe('bg-123')
        expect(r2!.started[0].type).toBe('shell')
        expect(r2!.started[0].command).toBe('find . -name "*.ts" | wc -l')
        expect(r2!.started[0].description).toBe('Count TS files')
        expect(r2!.started[0].status).toBe('running')

        // Phase 3: task-notification
        const r3 = tracker.processMessage(taskNotification('bg-123', 'Found 142 files'))
        expect(r3).not.toBeNull()
        expect(r3!.completed).toHaveLength(1)
        expect(r3!.completed[0].taskId).toBe('bg-123')
        expect(r3!.completed[0].summary).toBe('Found 142 files')
    })

    it('tracks an Agent background task through full lifecycle', () => {
        const tracker = new BackgroundTaskTracker()

        // Phase 1: assistant message with Agent tool_use
        const r1 = tracker.processMessage(assistantWithToolUse([{
            id: 'toolu_agent_1',
            name: 'Agent',
            input: {
                description: 'Explore Hub architecture',
                prompt: 'Analyze the hub/src directory',
                subagent_type: 'Explore',
                run_in_background: true,
            }
        }]))
        expect(r1).toBeNull()

        // Phase 2: agent tool_result
        const r2 = tracker.processMessage(userWithToolResult([{
            tool_use_id: 'toolu_agent_1',
            content: 'Async agent launched successfully.\nagentId: a1b2c3d4e5 (internal ID - do not mention to user.)'
        }]))
        expect(r2).not.toBeNull()
        expect(r2!.started).toHaveLength(1)
        expect(r2!.started[0].id).toBe('a1b2c3d4e5')
        expect(r2!.started[0].type).toBe('agent')
        expect(r2!.started[0].description).toBe('Explore Hub architecture')
        expect(r2!.started[0].prompt).toBe('Analyze the hub/src directory')
        expect(r2!.started[0].subagentType).toBe('Explore')

        // Phase 3: completion
        const r3 = tracker.processMessage(taskNotification('a1b2c3d4e5', 'Explored 15 files'))
        expect(r3).not.toBeNull()
        expect(r3!.completed[0].taskId).toBe('a1b2c3d4e5')
    })

    it('handles multiple concurrent tasks in one assistant message', () => {
        const tracker = new BackgroundTaskTracker()

        tracker.processMessage(assistantWithToolUse([
            { id: 'toolu_a1', name: 'Agent', input: { description: 'Agent 1', prompt: 'p1', subagent_type: 'Explore', run_in_background: true } },
            { id: 'toolu_b1', name: 'Bash', input: { command: 'ls -la', run_in_background: true } },
        ]))

        const r1 = tracker.processMessage(userWithToolResult([
            { tool_use_id: 'toolu_a1', content: 'Async agent launched successfully.\nagentId: agent-abc' },
        ]))
        expect(r1!.started).toHaveLength(1)
        expect(r1!.started[0].type).toBe('agent')

        const r2 = tracker.processMessage(userWithToolResult([
            { tool_use_id: 'toolu_b1', content: 'Command running in background with ID: shell-xyz' },
        ]))
        expect(r2!.started).toHaveLength(1)
        expect(r2!.started[0].type).toBe('shell')
        expect(r2!.started[0].command).toBe('ls -la')
    })

    it('ignores tool_uses without run_in_background', () => {
        const tracker = new BackgroundTaskTracker()

        tracker.processMessage(assistantWithToolUse([{
            id: 'toolu_normal',
            name: 'Bash',
            input: { command: 'echo hi' } // no run_in_background
        }]))

        const r = tracker.processMessage(userWithToolResult([{
            tool_use_id: 'toolu_normal',
            content: 'hi\n'
        }]))
        expect(r).toBeNull()
    })

    it('truncates long prompts to 500 chars', () => {
        const tracker = new BackgroundTaskTracker()
        const longPrompt = 'x'.repeat(1000)

        tracker.processMessage(assistantWithToolUse([{
            id: 'toolu_long',
            name: 'Agent',
            input: { description: 'Long prompt agent', prompt: longPrompt, subagent_type: 'general-purpose', run_in_background: true }
        }]))

        const r = tracker.processMessage(userWithToolResult([{
            tool_use_id: 'toolu_long',
            content: 'Async agent launched successfully.\nagentId: agent-long'
        }]))
        expect(r!.started[0].prompt).toHaveLength(500)
    })

    it('tracks Codex background agent summaries after the main turn summary', () => {
        const tracker = new BackgroundTaskTracker()

        expect(tracker.processMessage(wrap({
            type: 'summary',
            summary: 'Main turn title',
            leafUuid: 'main-uuid',
        }))).toBeNull()

        const r1 = tracker.processMessage(wrap({
            type: 'summary',
            summary: 'Inspect model flow',
            leafUuid: 'agent-uuid-1',
        }))

        expect(r1).not.toBeNull()
        expect(r1!.started).toHaveLength(1)
        expect(r1!.started[0]).toMatchObject({
            id: 'codex:agent-uuid-1',
            toolUseId: 'agent-uuid-1',
            type: 'agent',
            description: 'Inspect model flow',
            status: 'completed',
        })

        tracker.processMessage(event({ type: 'ready' }))
        expect(tracker.processMessage(wrap({
            type: 'summary',
            summary: 'Next main turn',
            leafUuid: 'main-uuid-2',
        }))).toBeNull()
    })
})

describe('extractBackgroundTaskDelta (legacy)', () => {
    it('detects Bash background start', () => {
        const msg = wrap({
            type: 'tool_result',
            content: 'Command running in background with ID: bg-1'
        })
        const delta = extractBackgroundTaskDelta(msg)
        expect(delta).toEqual({ started: 1, completed: 0 })
    })

    it('detects Agent background start', () => {
        const msg = wrap({
            type: 'user',
            message: { role: 'user', content: [{ type: 'tool_result', content: 'Async agent launched successfully.\nagentId: abc' }] }
        })
        const delta = extractBackgroundTaskDelta(msg)
        expect(delta).toEqual({ started: 1, completed: 0 })
    })

    it('detects task completion', () => {
        const msg = wrap({
            type: 'user',
            message: { role: 'user', content: '<task-notification>\n<task-id>bg-1</task-id>\n<status>completed</status>\n</task-notification>' }
        })
        const delta = extractBackgroundTaskDelta(msg)
        expect(delta).toEqual({ started: 0, completed: 1 })
    })

    it('returns null for non-background messages', () => {
        const msg = wrap({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] } })
        expect(extractBackgroundTaskDelta(msg)).toBeNull()
    })
})
