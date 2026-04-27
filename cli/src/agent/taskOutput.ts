import { resolve } from 'path'
import { readClaudeSessionLog } from '@/claude/utils/sessionScanner'

export async function readTaskOutputMessages(path: string, flavor?: string | null): Promise<unknown[]> {
    const normalizedFlavor = flavor ?? 'claude'
    if (normalizedFlavor !== 'claude') {
        throw new Error(`Task output is not supported for ${normalizedFlavor}`)
    }

    const { events } = await readClaudeSessionLog(resolve(path), 0)
    return events.map((entry) => entry.event)
}
