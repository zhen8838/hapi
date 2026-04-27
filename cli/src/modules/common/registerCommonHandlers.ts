import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { registerBashHandlers } from './handlers/bash'
import { registerDirectoryHandlers } from './handlers/directories'
import { registerDifftasticHandlers } from './handlers/difftastic'
import { registerFileHandlers } from './handlers/files'
import { registerGitHandlers } from './handlers/git'
import { registerRipgrepHandlers } from './handlers/ripgrep'
import { registerSlashCommandHandlers } from './handlers/slashCommands'
import { registerSkillsHandlers } from './handlers/skills'
import { registerUploadHandlers } from './handlers/uploads'

export function registerCommonHandlers(
    rpcHandlerManager: RpcHandlerManager,
    workingDirectory: string,
    options?: {
        allowAnyGitCwd?: boolean
        defaultTaskOutputFlavor?: string | null
        readTaskOutput?: (path: string, flavor?: string | null) => Promise<unknown[]>
    }
): void {
    registerBashHandlers(rpcHandlerManager, workingDirectory)
    registerFileHandlers(rpcHandlerManager, workingDirectory, {
        defaultTaskOutputFlavor: options?.defaultTaskOutputFlavor,
        readTaskOutput: options?.readTaskOutput
    })
    registerDirectoryHandlers(rpcHandlerManager, workingDirectory)
    registerRipgrepHandlers(rpcHandlerManager, workingDirectory)
    registerDifftasticHandlers(rpcHandlerManager, workingDirectory)
    registerSlashCommandHandlers(rpcHandlerManager, workingDirectory)
    registerSkillsHandlers(rpcHandlerManager, workingDirectory)
    registerGitHandlers(rpcHandlerManager, workingDirectory, { allowAnyCwd: options?.allowAnyGitCwd })
    registerUploadHandlers(rpcHandlerManager)
}
