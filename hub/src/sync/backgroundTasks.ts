import { isObject } from '@hapi/protocol'
import { unwrapRoleWrappedRecordEnvelope } from '@hapi/protocol/messages'

/**
 * A single background task (agent or shell) with its metadata.
 */
export type BackgroundTask = {
    id: string
    toolUseId: string
    type: 'agent' | 'shell'
    description?: string
    prompt?: string
    subagentType?: string
    command?: string
    status: 'running' | 'completed'
    startedAt: number
    completedAt?: number
    summary?: string
    outputFile?: string
}

/**
 * Pending tool_use that may become a background task once its tool_result arrives.
 */
type PendingToolUse = {
    toolUseId: string
    type: 'agent' | 'shell'
    description?: string
    prompt?: string
    subagentType?: string
    command?: string
}

/**
 * Tracks background task lifecycle across messages for a session.
 *
 * Usage:
 *   const tracker = new BackgroundTaskTracker()
 *   // For each message in order:
 *   const event = tracker.processMessage(messageContent)
 *   if (event) { // update session }
 */
export class BackgroundTaskTracker {
    /** Pending tool_uses from assistant messages, keyed by tool_use_id */
    private pending = new Map<string, PendingToolUse>()
    private codexSummaryCountInTurn = 0

    /**
     * Process a message and return any background task events.
     */
    processMessage(messageContent: unknown): BackgroundTaskEvent | null {
        const record = unwrapRoleWrappedRecordEnvelope(messageContent)
        if (!record || record.role !== 'agent') return null
        if (!isObject(record.content)) return null

        if (record.content.type === 'event') {
            const data = isObject(record.content.data) ? record.content.data : null
            if (data?.type === 'ready') {
                this.codexSummaryCountInTurn = 0
            }
            return null
        }

        if (record.content.type !== 'output') return null

        const data = isObject(record.content.data) ? record.content.data : null
        if (!data) return null

        const codexSummaryTask = this.matchCodexSummary(data)
        if (codexSummaryTask) {
            return { started: [codexSummaryTask], completed: [] }
        }

        // Phase 1: Extract pending tool_uses from assistant messages
        if (data.type === 'assistant') {
            this.extractPendingToolUses(data)
        }

        // Phase 2: Detect task starts from tool_result messages
        const starts = this.extractTaskStarts(record.content, data)

        // Phase 3: Detect task completions from task-notification messages
        const completions = this.extractTaskCompletions(data)

        if (starts.length === 0 && completions.length === 0) return null
        return { started: starts, completed: completions }
    }

    private matchCodexSummary(data: Record<string, unknown>): BackgroundTask | null {
        if (data.type !== 'summary') return null

        this.codexSummaryCountInTurn += 1
        if (this.codexSummaryCountInTurn === 1) return null

        const summary = typeof data.summary === 'string' ? data.summary.trim() : ''
        const leafUuid = typeof data.leafUuid === 'string' ? data.leafUuid : ''
        if (!summary || !leafUuid) return null

        const now = Date.now()
        return {
            id: `codex:${leafUuid}`,
            toolUseId: leafUuid,
            type: 'agent',
            description: summary,
            status: 'completed',
            startedAt: now,
            completedAt: now,
        }
    }

    /**
     * Extract tool_use blocks that may later emit a background task start.
     */
    private extractPendingToolUses(data: Record<string, unknown>): void {
        const message = isObject(data.message) ? data.message : null
        const modelContent = message?.content
        if (!Array.isArray(modelContent)) return

        for (const block of modelContent) {
            if (!isObject(block) || block.type !== 'tool_use') continue
            const input = isObject(block.input) ? block.input : null
            if (!input) continue

            const toolUseId = typeof block.id === 'string' ? block.id : null
            const name = typeof block.name === 'string' ? block.name : null
            if (!toolUseId || !name) continue

            if (name === 'Agent') {
                this.pending.set(toolUseId, {
                    toolUseId,
                    type: 'agent',
                    description: typeof input.description === 'string' ? input.description : undefined,
                    prompt: typeof input.prompt === 'string' ? input.prompt.slice(0, 500) : undefined,
                    subagentType: typeof input.subagent_type === 'string' ? input.subagent_type : undefined,
                })
            } else if (name === 'Bash' && input.run_in_background === true) {
                this.pending.set(toolUseId, {
                    toolUseId,
                    type: 'shell',
                    command: typeof input.command === 'string' ? input.command : undefined,
                    description: typeof input.description === 'string' ? input.description : undefined,
                })
            }
        }
    }

    /**
     * Detect background task starts from system task events or tool_result blocks.
     *
     * Claude async: { type: "system", subtype: "task_started", ... }
     * Bash: "Command running in background with ID: xxx"
     * Agent: "Async agent launched successfully.\nagentId: xxx"
     */
    private extractTaskStarts(content: Record<string, unknown>, data: Record<string, unknown>): BackgroundTask[] {
        const tasks: BackgroundTask[] = []
        const now = Date.now()

        if (data.type === 'system' && data.subtype === 'task_started') {
            const task = this.matchTaskStarted(data, now)
            if (task) tasks.push(task)
            return tasks
        }

        // Direct tool_result
        if (data.type === 'tool_result') {
            const task = this.matchToolResult(data, now)
            if (task) tasks.push(task)
            return tasks
        }

        // User message with content array of tool_results
        if (data.type === 'user') {
            const msg = isObject(data.message) ? data.message : null
            const msgContent = msg?.content
            if (Array.isArray(msgContent)) {
                for (const block of msgContent) {
                    if (isObject(block) && block.type === 'tool_result') {
                        const task = this.matchToolResult(block, now)
                        if (task) tasks.push(task)
                    }
                }
            }
        }

        return tasks
    }

    private matchTaskStarted(data: Record<string, unknown>, now: number): BackgroundTask | null {
        const taskId = typeof data.task_id === 'string' ? data.task_id : null
        if (!taskId) return null

        const taskType = typeof data.task_type === 'string' ? data.task_type : ''
        const type = taskType.includes('agent') ? 'agent'
            : taskType.includes('bash') ? 'shell'
                : null
        if (!type) return null

        const toolUseId = typeof data.tool_use_id === 'string' ? data.tool_use_id : taskId
        const pending = this.pending.get(toolUseId)
        if (pending) this.pending.delete(toolUseId)

        return {
            id: taskId,
            toolUseId,
            type: pending?.type ?? type,
            description: typeof data.description === 'string' ? data.description : pending?.description,
            prompt: typeof data.prompt === 'string' ? data.prompt.slice(0, 500) : pending?.prompt,
            subagentType: pending?.subagentType,
            command: pending?.command,
            status: 'running',
            startedAt: now,
            outputFile: typeof data.output_file === 'string' ? data.output_file : undefined,
        }
    }

    /**
     * Try to match a tool_result block to a pending tool_use and create a BackgroundTask.
     */
    private matchToolResult(block: Record<string, unknown>, now: number): BackgroundTask | null {
        const text = extractToolResultText(block)
        const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null

        // Bash background: "Command running in background with ID: xxx"
        const bashMatch = text.match(/Command running in background with ID:\s*([a-zA-Z0-9_-]+)/)
        if (bashMatch) {
            const pending = toolUseId ? this.pending.get(toolUseId) : null
            if (pending) this.pending.delete(toolUseId!)
            return {
                id: bashMatch[1],
                toolUseId: toolUseId ?? bashMatch[1],
                type: pending?.type ?? 'shell',
                description: pending?.description,
                command: pending?.command,
                prompt: pending?.prompt,
                subagentType: pending?.subagentType,
                status: 'running',
                startedAt: now,
            }
        }

        // Agent background: "Async agent launched successfully.\nagentId: xxx"
        const agentMatch = text.match(/Async agent launched successfully[\s\S]*?agentId:\s*(\S+)/)
        if (agentMatch) {
            const pending = toolUseId ? this.pending.get(toolUseId) : null
            if (pending) this.pending.delete(toolUseId!)
            return {
                id: agentMatch[1],
                toolUseId: toolUseId ?? agentMatch[1],
                type: pending?.type ?? 'agent',
                description: pending?.description,
                prompt: pending?.prompt,
                subagentType: pending?.subagentType,
                command: pending?.command,
                status: 'running',
                startedAt: now,
                outputFile: extractOutputFile(text),
            }
        }

        return null
    }

    /**
     * Detect task completions from task-notification messages.
     */
    private extractTaskCompletions(data: Record<string, unknown>): TaskCompletion[] {
        const completions: TaskCompletion[] = []

        if (data.type === 'system') {
            if (data.subtype === 'task_notification' && data.status === 'completed' && typeof data.task_id === 'string') {
                completions.push({
                    taskId: data.task_id,
                    toolUseId: typeof data.tool_use_id === 'string' ? data.tool_use_id : undefined,
                    summary: typeof data.summary === 'string' ? data.summary : undefined,
                    exitStatus: typeof data.status === 'string' ? data.status : undefined,
                    outputFile: typeof data.output_file === 'string' ? data.output_file : undefined,
                })
            }

            const patch = isObject(data.patch) ? data.patch : null
            if (data.subtype === 'task_updated' && patch?.status === 'completed' && typeof data.task_id === 'string') {
                completions.push({
                    taskId: data.task_id,
                    summary: typeof patch.summary === 'string' ? patch.summary : undefined,
                    exitStatus: typeof patch.status === 'string' ? patch.status : undefined,
                    outputFile: typeof patch.output_file === 'string' ? patch.output_file : undefined,
                })
            }

            return completions
        }

        const checkContent = (content: string) => {
            const trimmed = content.trimStart()
            if (!trimmed.startsWith('<task-notification>')) return
            const taskIdMatch = trimmed.match(/<task-id>([^<]+)<\/task-id>/)
            const toolUseIdMatch = trimmed.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)
            const summaryMatch = trimmed.match(/<summary>([^<]*)<\/summary>/)
            const statusMatch = trimmed.match(/<status>([^<]*)<\/status>/)
            const outputFileMatch = trimmed.match(/<output-file>([^<]+)<\/output-file>/)
            if (taskIdMatch) {
                completions.push({
                    taskId: taskIdMatch[1],
                    toolUseId: toolUseIdMatch?.[1],
                    summary: summaryMatch?.[1],
                    exitStatus: statusMatch?.[1],
                    outputFile: outputFileMatch?.[1],
                })
            }
        }

        // { type: 'user', message: { content: '<task-notification>...' } }
        if (data.type === 'user') {
            if (isObject(data.message)) {
                const msg = data.message as Record<string, unknown>
                if (typeof msg.content === 'string') {
                    checkContent(msg.content)
                } else if (Array.isArray(msg.content)) {
                    for (const block of msg.content) {
                        if (isObject(block) && typeof block.text === 'string') {
                            checkContent(block.text)
                        }
                    }
                }
            }
            if (typeof data.content === 'string') {
                checkContent(data.content)
            }
        }

        return completions
    }
}

export type TaskCompletion = {
    taskId: string
    toolUseId?: string
    summary?: string
    exitStatus?: string
    outputFile?: string
}

export type BackgroundTaskEvent = {
    started: BackgroundTask[]
    completed: TaskCompletion[]
}

function extractToolResultText(block: Record<string, unknown>): string {
    if (typeof block.content === 'string') return block.content
    if (Array.isArray(block.content)) {
        return block.content
            .map((c: unknown) => isObject(c) && typeof c.text === 'string' ? c.text : '')
            .join('')
    }
    return ''
}

function extractOutputFile(text: string): string | undefined {
    return text.match(/output_file:\s*(\S+)/)?.[1]
}

// --- Legacy compatibility ---

/**
 * Legacy: extract simple start/completion counts (kept for backward compat).
 */
export function extractBackgroundTaskDelta(messageContent: unknown): { started: number; completed: number } | null {
    const record = unwrapRoleWrappedRecordEnvelope(messageContent)
    if (!record || record.role !== 'agent') return null
    if (!isObject(record.content) || record.content.type !== 'output') return null

    const data = isObject(record.content.data) ? record.content.data : null
    if (!data) return null

    const started = countTaskStarts(record.content)
    const completed = data.type === 'system' ? countSystemTaskCompletions(data)
        : data.type === 'user' ? countTaskCompletions(data)
            : 0

    if (started === 0 && completed === 0) return null
    return { started, completed }
}

function countTaskStarts(content: Record<string, unknown>): number {
    const data = isObject(content.data) ? content.data : null
    if (!data) return 0

    if (data.type === 'tool_result') {
        return isBackgroundStartResult(data) ? 1 : 0
    }

    if (data.type === 'assistant') {
        const message = isObject(data.message) ? data.message : null
        const modelContent = message?.content
        if (!Array.isArray(modelContent)) return 0

        let count = 0
        for (const block of modelContent) {
            if (isObject(block) && block.type === 'tool_result' && isBackgroundStartResult(block)) {
                count++
            }
        }
        return count
    }

    // User message with tool_result array
    if (data.type === 'user') {
        const msg = isObject(data.message) ? data.message : null
        const msgContent = msg?.content
        if (!Array.isArray(msgContent)) return 0
        let count = 0
        for (const block of msgContent) {
            if (isObject(block) && block.type === 'tool_result' && isBackgroundStartResult(block)) {
                count++
            }
        }
        return count
    }

    return 0
}

function isBackgroundStartResult(block: Record<string, unknown>): boolean {
    const text = extractToolResultText(block)
    return text.includes('Command running in background with ID:')
        || text.includes('Async agent launched successfully')
}

function countTaskCompletions(data: Record<string, unknown>): number {
    if (isObject(data.message)) {
        const msg = data.message as Record<string, unknown>
        if (typeof msg.content === 'string' && msg.content.trimStart().startsWith('<task-notification>')) {
            return 1
        }
    }
    if (typeof data.content === 'string' && data.content.trimStart().startsWith('<task-notification>')) {
        return 1
    }
    return 0
}

function countSystemTaskCompletions(data: Record<string, unknown>): number {
    const patch = isObject(data.patch) ? data.patch : null
    return data.subtype === 'task_updated' && patch?.status === 'completed' ? 1 : 0
}
