import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CopyIcon, CheckIcon, GitBranchIcon, FolderGit2Icon } from '@/components/icons'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'
import { queryKeys } from '@/lib/query-keys'

type SessionGroup = {
    key: string
    directory: string
    displayName: string
    machineId: string | null
    sessions: SessionSummary[]
    latestUpdatedAt: number
    hasActiveSession: boolean
}

type MachineGroup = {
    machineId: string | null
    label: string
    projectGroups: SessionGroup[]
    totalSessions: number
    hasActiveSession: boolean
    latestUpdatedAt: number
}

function getGroupDisplayName(directory: string): string {
    if (directory === 'Other') return directory
    const parts = directory.split(/[\\/]+/).filter(Boolean)
    if (parts.length === 0) return directory
    if (parts.length === 1) return parts[0]
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

export const UNKNOWN_MACHINE_ID = '__unknown__'

function groupSessionsByDirectory(sessions: SessionSummary[]): SessionGroup[] {
    const groups = new Map<string, { directory: string; machineId: string | null; sessions: SessionSummary[] }>()

    sessions.forEach(session => {
        const path = session.metadata?.worktree?.basePath ?? session.metadata?.path ?? 'Other'
        const machineId = session.metadata?.machineId ?? null
        const key = `${machineId ?? UNKNOWN_MACHINE_ID}::${path}`
        if (!groups.has(key)) {
            groups.set(key, {
                directory: path,
                machineId,
                sessions: []
            })
        }
        groups.get(key)!.sessions.push(session)
    })

    return Array.from(groups.entries())
        .map(([key, group]) => {
            const sortedSessions = [...group.sessions].sort((a, b) => {
                const rankA = a.active ? (a.pendingRequestsCount > 0 ? 0 : 1) : 2
                const rankB = b.active ? (b.pendingRequestsCount > 0 ? 0 : 1) : 2
                if (rankA !== rankB) return rankA - rankB
                return b.updatedAt - a.updatedAt
            })
            const latestUpdatedAt = group.sessions.reduce(
                (max, s) => (s.updatedAt > max ? s.updatedAt : max),
                -Infinity
            )
            const hasActiveSession = group.sessions.some(s => s.active)
            const displayName = getGroupDisplayName(group.directory)

            return {
                key,
                directory: group.directory,
                displayName,
                machineId: group.machineId,
                sessions: sortedSessions,
                latestUpdatedAt,
                hasActiveSession
            }
        })
        .sort((a, b) => {
            if (a.hasActiveSession !== b.hasActiveSession) {
                return a.hasActiveSession ? -1 : 1
            }
            return b.latestUpdatedAt - a.latestUpdatedAt
        })
}

function groupByMachine(
    groups: SessionGroup[],
    resolveMachineLabel: (id: string | null) => string
): MachineGroup[] {
    const map = new Map<string, MachineGroup>()
    for (const g of groups) {
        const key = g.machineId ?? UNKNOWN_MACHINE_ID
        let mg = map.get(key)
        if (!mg) {
            mg = {
                machineId: g.machineId,
                label: resolveMachineLabel(g.machineId),
                projectGroups: [],
                totalSessions: 0,
                hasActiveSession: false,
                latestUpdatedAt: 0,
            }
            map.set(key, mg)
        }
        mg.projectGroups.push(g)
        mg.totalSessions += g.sessions.length
        if (g.hasActiveSession) mg.hasActiveSession = true
        if (g.latestUpdatedAt > mg.latestUpdatedAt) mg.latestUpdatedAt = g.latestUpdatedAt
    }
    return [...map.values()].sort((a, b) => {
        if (a.hasActiveSession !== b.hasActiveSession) return a.hasActiveSession ? -1 : 1
        return b.latestUpdatedAt - a.latestUpdatedAt
    })
}

function CopyPathButton({ path, className }: { path: string; className?: string }) {
    const [copied, setCopied] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(path)
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 1500)
    }

    useEffect(() => () => clearTimeout(timerRef.current), [])

    return (
        <button
            type="button"
            className={`shrink-0 p-0.5 rounded transition-colors ${copied ? 'text-[var(--app-badge-success-text)]' : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'} ${className ?? ''}`}
            title={copied ? 'Copied!' : `Copy: ${path}`}
            onClick={handleClick}
        >
            {copied
                ? <CheckIcon className="h-3.5 w-3.5" />
                : <CopyIcon className="h-3.5 w-3.5" />
            }
        </button>
    )
}

function PlusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function LoaderIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
    )
}

function BulbIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2a7 7 0 0 0-4-12Z" />
        </svg>
    )
}

function ChevronIcon(props: { className?: string; collapsed?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${props.className ?? ''} transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function getSessionTitle(session: SessionSummary): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        const parts = session.metadata.path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : session.id.slice(0, 8)
    }
    return session.id.slice(0, 8)
}

function getTodoProgress(session: SessionSummary): { completed: number; total: number } | null {
    if (!session.todoProgress) return null
    if (session.todoProgress.completed === session.todoProgress.total) return null
    return session.todoProgress
}

function useSessionGitMetadata(api: ApiClient | null, session: SessionSummary) {
    return useQuery({
        queryKey: queryKeys.gitMetadata(session.id),
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getGitMetadata(session.id)
        },
        enabled: Boolean(api && session.metadata?.path),
        staleTime: 10_000,
        refetchInterval: session.active ? 10_000 : false,
        retry: false
    })
}

/** Anthropic Claude logo (SimpleIcons) */
function ClaudeLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#D97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
        </svg>
    )
}

/** OpenAI logo for Codex (SimpleIcons) */
function CodexLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#111827" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
        </svg>
    )
}

/** Google Gemini logo (SimpleIcons) */
function GeminiLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#8E75B2" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
        </svg>
    )
}

/** Cursor IDE logo (SimpleIcons) */
function CursorLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#000000" d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/>
        </svg>
    )
}

/** OpenCode logo — code brackets */
function OpenCodeLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 7L3 12l5 5M16 7l5 5-5 5M14 4l-4 16" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

const FLAVOR_ICONS: Record<string, (className?: string) => React.ReactNode> = {
    claude: (cls) => <ClaudeLogo className={cls} />,
    codex: (cls) => <CodexLogo className={cls} />,
    cursor: (cls) => <CursorLogo className={cls} />,
    gemini: (cls) => <GeminiLogo className={cls} />,
    opencode: (cls) => <OpenCodeLogo className={cls} />,
}

function FlavorIcon({ flavor, className }: { flavor?: string | null; className?: string }) {
    const key = (flavor ?? 'claude').trim().toLowerCase()
    const renderIcon = FLAVOR_ICONS[key] ?? FLAVOR_ICONS.claude
    return (
        <span aria-hidden="true" className={`inline-flex items-center justify-center ${className ?? 'h-4 w-4'}`}>
            {renderIcon(className ?? 'h-4 w-4')}
        </span>
    )
}

function MachineIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    )
}

function formatRelativeTime(value: number, t: (key: string, params?: Record<string, string | number>) => string): string | null {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    if (!Number.isFinite(ms)) return null
    const delta = Date.now() - ms
    if (delta < 60_000) return t('session.time.justNow')
    const minutes = Math.floor(delta / 60_000)
    if (minutes < 60) return t('session.time.minutesAgo', { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('session.time.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('session.time.daysAgo', { n: days })
    return new Date(ms).toLocaleDateString()
}

function SessionItem(props: {
    session: SessionSummary
    onSelect: (sessionId: string) => void
    showPath?: boolean
    api: ApiClient | null
    selected?: boolean
}) {
    const { t } = useTranslation()
    const { addToast } = useToast()
    const navigate = useNavigate()
    const { session: s, onSelect, showPath = true, api, selected = false } = props
    const { haptic } = usePlatform()
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        s.id,
        s.metadata?.flavor ?? null
    )

    const longPressHandlers = useLongPress({
        onLongPress: (point) => {
            haptic.impact('medium')
            setMenuAnchorPoint(point)
            setMenuOpen(true)
        },
        onClick: () => {
            if (!menuOpen) {
                onSelect(s.id)
            }
        },
        threshold: 500
    })

    const sessionName = getSessionTitle(s)
    const todoProgress = getTodoProgress(s)
    const gitMetadata = useSessionGitMetadata(api, s).data
    const gitBranch = gitMetadata?.success ? gitMetadata.branch : s.metadata?.worktree?.branch
    const worktreeName = gitMetadata?.success ? gitMetadata.worktreeName : s.metadata?.worktree?.name
    return (
        <>
            <button
                type="button"
                {...longPressHandlers}
                className={`session-list-item flex w-full flex-col gap-1 px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none rounded-lg ${selected ? 'bg-[var(--app-secondary-bg)]' : ''}`}
                style={{ WebkitTouchCallout: 'none' }}
                aria-current={selected ? 'page' : undefined}
            >
                <div className={`flex items-center justify-between gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <FlavorIcon flavor={s.metadata?.flavor} className="h-4 w-4 shrink-0" />
                        <div className={`truncate text-sm font-medium ${s.active ? 'text-[var(--app-fg)]' : 'text-[var(--app-hint)]'}`}>
                            {sessionName}
                        </div>
                        {s.active && s.thinking ? (
                            <LoaderIcon className="h-3.5 w-3.5 shrink-0 text-[var(--app-hint)] animate-spin-slow" />
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                        {todoProgress ? (
                            <span className="flex items-center gap-1 text-[var(--app-hint)]">
                                <BulbIcon className="h-3 w-3" />
                                {todoProgress.completed}/{todoProgress.total}
                            </span>
                        ) : null}
                        {s.pendingRequestsCount > 0 ? (
                            <span className="text-[var(--app-badge-warning-text)]">
                                {t('session.item.pending')} {s.pendingRequestsCount}
                            </span>
                        ) : null}
                        <span className="text-[var(--app-hint)]">
                            {formatRelativeTime(s.updatedAt, t)}
                        </span>
                    </div>
                </div>
                {showPath ? (
                    <div className="truncate text-xs text-[var(--app-hint)]">
                        {s.metadata?.path ?? s.id}
                    </div>
                ) : null}
                {gitBranch ? (
                    <div className="flex items-center gap-1 min-w-0 text-xs text-[var(--app-hint)]">
                        <GitBranchIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{gitBranch}</span>
                    </div>
                ) : null}
                {worktreeName ? (
                    <div className="flex items-center gap-1 min-w-0 text-xs text-[var(--app-hint)]">
                        <FolderGit2Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{worktreeName}</span>
                    </div>
                ) : null}
            </button>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={s.active}
                onRename={() => setRenameOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                onCopyId={() => {
                    const idToCopy = s.metadata?.agentSessionId ?? s.id
                    try {
                        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                            navigator.clipboard.writeText(idToCopy).catch(() => {})
                        } else {
                            const textarea = document.createElement('textarea')
                            textarea.value = idToCopy
                            textarea.style.position = 'fixed'
                            textarea.style.opacity = '0'
                            document.body.appendChild(textarea)
                            textarea.select()
                            document.execCommand('copy')
                            document.body.removeChild(textarea)
                        }
                    } catch {
                        // ignore clipboard errors
                    }
                    addToast({ title: t('session.action.copyIdDone'), body: idToCopy, sessionId: '', url: '' })
                }}
                forkVisible={s.metadata?.flavor === 'claude'}
                onFork={async () => {
                    if (s.active) {
                        addToast({ title: t('session.action.forkError'), body: 'Session must be inactive', sessionId: s.id, url: '' })
                        return
                    }
                    addToast({ title: t('session.action.forking'), body: '', sessionId: s.id, url: '' })
                    try {
                        const newSessionId = await api!.forkSession(s.id)
                        addToast({ title: t('session.action.forkSuccess'), body: '', sessionId: newSessionId, url: '' })
                        navigate({ to: '/sessions/$sessionId', params: { sessionId: newSessionId } })
                    } catch (error) {
                        const msg = String(error)
                        const body = msg.includes('resume_unavailable')
                            ? 'This session has no Claude session ID. Try resuming it first, then fork.'
                            : msg
                        addToast({ title: t('session.action.forkError'), body, sessionId: '', url: '' })
                    }
                }}
                anchorPoint={menuAnchorPoint}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={sessionName}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: sessionName })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={archiveSession}
                isPending={isPending}
                destructive
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: sessionName })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={deleteSession}
                isPending={isPending}
                destructive
            />
        </>
    )
}

export function SessionList(props: {
    sessions: SessionSummary[]
    onSelect: (sessionId: string) => void
    onNewSession: () => void
    onRefresh: () => void
    isLoading: boolean
    renderHeader?: boolean
    api: ApiClient | null
    machineLabelsById?: Record<string, string>
    selectedSessionId?: string | null
}) {
    const { t } = useTranslation()
    const { renderHeader = true, api, selectedSessionId, machineLabelsById = {} } = props
    const groups = useMemo(
        () => groupSessionsByDirectory(props.sessions),
        [props.sessions]
    )
    const [collapseOverrides, setCollapseOverrides] = useState<Map<string, boolean>>(
        () => new Map()
    )
    const isGroupCollapsed = (group: SessionGroup): boolean => {
        const override = collapseOverrides.get(group.key)
        if (override !== undefined) return override
        const hasSelectedSession = selectedSessionId
            ? group.sessions.some(session => session.id === selectedSessionId)
            : false
        return !group.hasActiveSession && !hasSelectedSession
    }

    const toggleGroup = (groupKey: string, isCollapsed: boolean) => {
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(groupKey, !isCollapsed)
            return next
        })
    }

    const resolveMachineLabel = (machineId: string | null): string => {
        if (machineId && machineLabelsById[machineId]) {
            return machineLabelsById[machineId]
        }
        if (machineId) {
            return machineId.slice(0, 8)
        }
        return t('machine.unknown')
    }

    const machineGroups = useMemo(
        () => groupByMachine(groups, resolveMachineLabel),
        [groups, machineLabelsById] // eslint-disable-line react-hooks/exhaustive-deps
    )

    const isMachineCollapsed = (mg: MachineGroup): boolean => {
        const key = `machine::${mg.machineId ?? UNKNOWN_MACHINE_ID}`
        const override = collapseOverrides.get(key)
        if (override !== undefined) return override
        const hasSelected = selectedSessionId
            ? mg.projectGroups.some(pg => pg.sessions.some(s => s.id === selectedSessionId))
            : false
        return !mg.hasActiveSession && !hasSelected
    }

    const toggleMachine = (mg: MachineGroup) => {
        const key = `machine::${mg.machineId ?? UNKNOWN_MACHINE_ID}`
        const current = isMachineCollapsed(mg)
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(key, !current)
            return next
        })
    }

    // Auto-expand group (and machine) containing selected session
    useEffect(() => {
        if (!selectedSessionId) return
        setCollapseOverrides(prev => {
            const group = groups.find(g =>
                g.sessions.some(s => s.id === selectedSessionId)
            )
            if (!group) return prev
            const next = new Map(prev)
            let changed = false
            // Expand project group if collapsed
            if (prev.has(group.key) && prev.get(group.key)) {
                next.delete(group.key)
                changed = true
            }
            // Expand machine group if collapsed
            const machineKey = `machine::${group.machineId ?? UNKNOWN_MACHINE_ID}`
            if (prev.has(machineKey) && prev.get(machineKey)) {
                next.delete(machineKey)
                changed = true
            }
            return changed ? next : prev
        })
    }, [selectedSessionId, groups])

    // Clean up stale collapse overrides
    useEffect(() => {
        setCollapseOverrides(prev => {
            if (prev.size === 0) return prev
            const next = new Map(prev)
            const knownKeys = new Set<string>()
            for (const g of groups) {
                knownKeys.add(g.key)
                knownKeys.add(`machine::${g.machineId ?? UNKNOWN_MACHINE_ID}`)
            }
            let changed = false
            for (const key of next.keys()) {
                if (!knownKeys.has(key)) {
                    next.delete(key)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [groups])

    return (
        <div className="mx-auto w-full max-w-content flex flex-col">
            {renderHeader ? (
                <div className="flex items-center justify-between px-3 py-1">
                    <div className="text-xs text-[var(--app-hint)]">
                        {t('sessions.count', { n: props.sessions.length, m: groups.length })}
                    </div>
                    <button
                        type="button"
                        onClick={props.onNewSession}
                        className="session-list-new-button p-1.5 rounded-full text-[var(--app-link)] transition-colors"
                        title={t('sessions.new')}
                    >
                        <PlusIcon className="h-5 w-5" />
                    </button>
                </div>
            ) : null}

            <div className="flex flex-col gap-3 px-2 pt-1 pb-2">
                {machineGroups.map((mg) => {
                    const machineCollapsed = isMachineCollapsed(mg)
                    return (
                        <div key={mg.machineId ?? UNKNOWN_MACHINE_ID}>
                            {/* Level 1: Machine */}
                            <button
                                type="button"
                                onClick={() => toggleMachine(mg)}
                                className="flex w-full items-center gap-2 px-1 py-1.5 text-left rounded-lg transition-colors hover:bg-[var(--app-subtle-bg)] select-none"
                            >
                                <ChevronIcon className="h-4 w-4 text-[var(--app-hint)] shrink-0" collapsed={machineCollapsed} />
                                <MachineIcon className="h-4 w-4 text-[var(--app-hint)] shrink-0" />
                                <span className="text-sm font-semibold truncate flex-1">{mg.label}</span>
                                <span className="text-[11px] tabular-nums text-[var(--app-hint)] shrink-0">({mg.totalSessions})</span>
                            </button>

                            {/* Level 2: Projects */}
                            <div className="collapsible-panel" data-open={!machineCollapsed || undefined}>
                                <div className="collapsible-inner">
                                <div className="flex flex-col ml-3.5 pl-1 mt-0.5">
                                    {mg.projectGroups.map((group) => {
                                        const isCollapsed = isGroupCollapsed(group)
                                        return (
                                            <div key={group.key}>
                                                <div
                                                    className="group/project sticky top-0 z-10 flex items-center gap-2 px-1 py-1.5 text-left rounded-lg transition-colors hover:bg-[var(--app-subtle-bg)] cursor-pointer min-w-0 w-full select-none"
                                                    onClick={() => toggleGroup(group.key, isCollapsed)}
                                                    title={group.directory}
                                                >
                                                    <ChevronIcon className="h-3.5 w-3.5 text-[var(--app-hint)] shrink-0" collapsed={isCollapsed} />
                                                    <span className="font-medium text-sm truncate flex-1">
                                                        {group.displayName}
                                                    </span>
                                                    <CopyPathButton path={group.directory} className="opacity-0 group-hover/project:opacity-100 transition-opacity duration-150" />
                                                    <span className="text-[11px] tabular-nums text-[var(--app-hint)] shrink-0">
                                                        ({group.sessions.length})
                                                    </span>
                                                </div>

                                                {/* Level 3: Sessions */}
                                                <div className="collapsible-panel" data-open={!isCollapsed || undefined}>
                                                    <div className="collapsible-inner">
                                                    <div className="flex flex-col gap-0.5 ml-3 pl-1 pr-1 py-1">
                                                        {group.sessions.map((s) => (
                                                            <SessionItem
                                                                key={s.id}
                                                                session={s}
                                                                onSelect={props.onSelect}
                                                                showPath={false}
                                                                api={api}
                                                                selected={s.id === selectedSessionId}
                                                            />
                                                        ))}
                                                    </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
