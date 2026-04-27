import { execFile, type ExecFileOptions } from 'child_process'
import { promisify } from 'util'
import { basename, dirname, isAbsolute, resolve } from 'path'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { validatePath } from '../pathSecurity'
import { rpcError } from '../rpcResponses'

const execFileAsync = promisify(execFile)

interface GitStatusRequest {
    cwd?: string
    timeout?: number
}

interface GitDiffNumstatRequest {
    cwd?: string
    staged?: boolean
    timeout?: number
}

interface GitDiffFileRequest {
    cwd?: string
    filePath: string
    staged?: boolean
    timeout?: number
}

interface GitMetadataRequest {
    cwd?: string
    timeout?: number
}

interface GitCommandResponse {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

interface GitMetadataResponse {
    success: boolean
    branch?: string
    worktreePath?: string
    worktreeName?: string
    basePath?: string
    error?: string
}

function resolveCwd(requestedCwd: string | undefined, workingDirectory: string, allowAnyCwd = false): { cwd: string; error?: string } {
    const cwd = requestedCwd ?? workingDirectory
    if (allowAnyCwd) {
        return { cwd }
    }
    const validation = validatePath(cwd, workingDirectory)
    if (!validation.valid) {
        return { cwd, error: validation.error ?? 'Invalid working directory' }
    }
    return { cwd }
}

function validateFilePath(filePath: string, workingDirectory: string): string | null {
    const validation = validatePath(filePath, workingDirectory)
    if (!validation.valid) {
        return validation.error ?? 'Invalid file path'
    }
    return null
}

async function runGitCommand(
    args: string[],
    cwd: string,
    timeout?: number
): Promise<GitCommandResponse> {
    try {
        const options: ExecFileOptions = {
            cwd,
            timeout: timeout ?? 10_000
        }
        const { stdout, stderr } = await execFileAsync('git', args, options)
        return {
            success: true,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : '',
            exitCode: 0
        }
    } catch (error) {
        const execError = error as NodeJS.ErrnoException & {
            stdout?: string
            stderr?: string
            code?: number | string
            killed?: boolean
        }

        if (execError.code === 'ETIMEDOUT' || execError.killed) {
            return rpcError('Command timed out', {
                stdout: execError.stdout ? execError.stdout.toString() : '',
                stderr: execError.stderr ? execError.stderr.toString() : '',
                exitCode: typeof execError.code === 'number' ? execError.code : -1
            })
        }

        return rpcError(execError.message || 'Command failed', {
            stdout: execError.stdout ? execError.stdout.toString() : '',
            stderr: execError.stderr ? execError.stderr.toString() : execError.message || 'Command failed',
            exitCode: typeof execError.code === 'number' ? execError.code : 1
        })
    }
}

async function runGitText(args: string[], cwd: string, timeout?: number): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync('git', args, {
            cwd,
            timeout: timeout ?? 10_000
        })
        const text = stdout.toString().trim()
        return text.length > 0 ? text : null
    } catch {
        return null
    }
}

function normalizePath(rawPath: string, cwd: string): string {
    return isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath)
}

export function registerGitHandlers(
    rpcHandlerManager: RpcHandlerManager,
    workingDirectory: string,
    options?: { allowAnyCwd?: boolean }
): void {
    rpcHandlerManager.registerHandler<GitStatusRequest, GitCommandResponse>('git-status', async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory, options?.allowAnyCwd)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        return await runGitCommand(
            ['status', '--porcelain=v2', '--branch', '--untracked-files=all'],
            resolved.cwd,
            data.timeout
        )
    })

    rpcHandlerManager.registerHandler<GitDiffNumstatRequest, GitCommandResponse>('git-diff-numstat', async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory, options?.allowAnyCwd)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        const args = data.staged
            ? ['diff', '--cached', '--numstat']
            : ['diff', '--numstat']
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    rpcHandlerManager.registerHandler<GitDiffFileRequest, GitCommandResponse>('git-diff-file', async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory, options?.allowAnyCwd)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        const fileError = validateFilePath(data.filePath, resolved.cwd)
        if (fileError) {
            return rpcError(fileError)
        }

        const args = data.staged
            ? ['diff', '--cached', '--no-ext-diff', '--', data.filePath]
            : ['diff', '--no-ext-diff', '--', data.filePath]
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    rpcHandlerManager.registerHandler<GitMetadataRequest, GitMetadataResponse>('git-metadata', async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory, options?.allowAnyCwd)
        if (resolved.error) {
            return rpcError(resolved.error)
        }

        const worktreeRoot = await runGitText(['rev-parse', '--show-toplevel'], resolved.cwd, data.timeout)
        if (!worktreeRoot) {
            return rpcError('Git repository not available')
        }

        const branch = await runGitText(['symbolic-ref', '--short', 'HEAD'], resolved.cwd, data.timeout)
            ?? await runGitText(['rev-parse', '--short', 'HEAD'], resolved.cwd, data.timeout)
            ?? undefined
        const gitDir = await runGitText(['rev-parse', '--git-dir'], resolved.cwd, data.timeout)
        const commonDir = await runGitText(['rev-parse', '--git-common-dir'], resolved.cwd, data.timeout)
        const worktreePath = normalizePath(worktreeRoot, resolved.cwd)
        const basePath = gitDir && commonDir && normalizePath(gitDir, resolved.cwd) !== normalizePath(commonDir, resolved.cwd)
            ? dirname(normalizePath(commonDir, resolved.cwd))
            : worktreePath

        return {
            success: true,
            branch,
            worktreePath,
            worktreeName: basename(worktreePath),
            basePath
        }
    })
}
