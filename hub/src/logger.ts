import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function logsDir(): string {
    const home = process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')
    const dir = join(home, 'logs')
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
    return dir
}

function timestampForFilename(date: Date = new Date()): string {
    return date.toLocaleString('sv-SE', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/[: ]/g, '-').replace(/,/g, '') + '-pid-' + process.pid
}

function timestampForLogEntry(date: Date = new Date()): string {
    return date.toLocaleTimeString('en-US', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    })
}

class Logger {
    readonly logFilePath = join(logsDir(), `${timestampForFilename()}-hub.log`)

    isDebugEnabled(): boolean {
        return Boolean(process.env.DEBUG) || process.env.HAPI_LOG_LEVEL?.toLowerCase() === 'debug'
    }

    debug(message: string, ...args: unknown[]): void {
        this.logToFile('debug', message, ...args)
    }

    info(message: string, ...args: unknown[]): void {
        console.log(message, ...args)
        this.logToFile('info', message, ...args)
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(message, ...args)
        this.logToFile('warn', message, ...args)
    }

    error(message: string, ...args: unknown[]): void {
        console.error(message, ...args)
        this.logToFile('error', message, ...args)
    }

    private logToFile(level: string, message: string, ...args: unknown[]): void {
        const formattedArgs = args.map(formatArg).join(' ')
        appendFileSync(this.logFilePath, `[${timestampForLogEntry()}] [${level}] ${message} ${formattedArgs}\n`)
    }
}

function formatArg(arg: unknown): string {
    if (typeof arg === 'string') {
        return arg
    }
    if (arg instanceof Error) {
        return arg.stack ?? arg.message
    }
    return JSON.stringify(arg)
}

export const logger = new Logger()
