import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type {
    AttachmentMetadata,
    CodexCollaborationMode,
    DecryptedMessage,
    PermissionMode,
    Session,
    SlashCommand
} from '@/types/api'
import type { ChatBlock, NormalizedMessage, ToolCallBlock } from '@/chat/types'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { normalizeDecryptedMessage } from '@/chat/normalize'
import { reduceChatBlocks } from '@/chat/reducer'
import { reconcileChatBlocks } from '@/chat/reconcile'
import { HappyComposer } from '@/components/AssistantChat/HappyComposer'
import { HappyThread } from '@/components/AssistantChat/HappyThread'
import { useHappyRuntime } from '@/lib/assistant-runtime'
import { createAttachmentAdapter } from '@/lib/attachmentAdapter'
import { findUnsupportedCodexBuiltinSlashCommand } from '@/lib/codexSlashCommands'
import { useToast } from '@/lib/toast-context'
import { useTranslation } from '@/lib/use-translation'
import { SessionHeader } from '@/components/SessionHeader'
import { TeamPanel } from '@/components/TeamPanel'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { useModelOptions } from '@/hooks/queries/useModelOptions'
import { useVoiceOptional } from '@/lib/voice-context'
import { RealtimeVoiceSession, registerSessionStore, registerVoiceHooksStore, voiceHooks } from '@/realtime'
import { isRemoteTerminalSupported } from '@/utils/terminalSupport'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draftStore'

export function SessionChat(props: {
    api: ApiClient
    session: Session
    messages: DecryptedMessage[]
    messagesWarning: string | null
    hasMoreMessages: boolean
    isLoadingMessages: boolean
    isLoadingMoreMessages: boolean
    isSending: boolean
    pendingCount: number
    messagesVersion: number
    onBack: () => void
    onRefresh: () => void
    onLoadMore: () => Promise<unknown>
    onSend: (text: string, attachments?: AttachmentMetadata[]) => void
    onFlushPending: () => void
    onAtBottomChange: (atBottom: boolean) => void
    onRetryMessage?: (localId: string) => void
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    availableSlashCommands?: readonly SlashCommand[]
}) {
    const { haptic } = usePlatform()
    const { addToast } = useToast()
    const { t } = useTranslation()
    const { getOptions: getModelOptions } = useModelOptions(props.api, true)
    const navigate = useNavigate()
    const sessionInactive = !props.session.active
    const terminalSupported = isRemoteTerminalSupported(props.session.metadata)
    const mainTurnRunning = props.session.thinking
    const normalizedCacheRef = useRef<Map<string, { source: DecryptedMessage; normalized: NormalizedMessage | null }>>(new Map())
    const blocksByIdRef = useRef<Map<string, ChatBlock>>(new Map())
    const [forceScrollToken, setForceScrollToken] = useState(0)
    const agentFlavor = props.session.metadata?.flavor ?? null
    const controlledByUser = props.session.agentState?.controlledByUser === true
    const codexCollaborationModeSupported = agentFlavor === 'codex' && !controlledByUser
    const {
        abortSession,
        switchSession,
        setPermissionMode,
        setCollaborationMode,
        setModel,
        setModelReasoningEffort,
        setEffort
    } = useSessionActions(
        props.api,
        props.session.id,
        agentFlavor,
        codexCollaborationModeSupported
    )
    const readBackgroundTaskOutput = useCallback(async (taskId: string) => {
        const result = await props.api.readBackgroundTaskOutput(props.session.id, taskId)
        if (!result.success) {
            throw new Error(result.error ?? 'Failed to read task output')
        }
        return result.messages ?? []
    }, [props.api, props.session.id])

    // Voice assistant integration
    const voice = useVoiceOptional()

    // Register session store for voice client tools
    useEffect(() => {
        registerSessionStore({
            getSession: () => props.session as { agentState?: { requests?: Record<string, unknown> } } | null,
            sendMessage: (_sessionId: string, message: string) => props.onSend(message),
            approvePermission: async (_sessionId: string, requestId: string) => {
                await props.api.approvePermission(props.session.id, requestId)
                props.onRefresh()
            },
            denyPermission: async (_sessionId: string, requestId: string) => {
                await props.api.denyPermission(props.session.id, requestId)
                props.onRefresh()
            }
        })
    }, [props.session, props.api, props.onSend, props.onRefresh])

    useEffect(() => {
        registerVoiceHooksStore(
            (sessionId) => (sessionId === props.session.id ? props.session : null),
            (sessionId) => (sessionId === props.session.id ? props.messages : [])
        )
    }, [props.session, props.messages])

    // Track and report new messages to voice assistant
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevMessagesRef = useRef<DecryptedMessage[]>([])

    useEffect(() => {
        const prevIds = new Set(prevMessagesRef.current.map(m => m.id))
        const newMessages = props.messages.filter(m => !prevIds.has(m.id))

        if (newMessages.length > 0) {
            voiceHooks.onMessages(props.session.id, newMessages)
        }

        prevMessagesRef.current = props.messages
    }, [props.messages, props.session.id])

    // Report ready event when thinking stops
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevThinkingRef = useRef(props.session.thinking)

    useEffect(() => {
        // Detect transition: thinking → not thinking
        if (prevThinkingRef.current && !props.session.thinking) {
            voiceHooks.onReady(props.session.id)
        }

        prevThinkingRef.current = props.session.thinking
    }, [props.session.thinking, props.session.id])

    // Report permission requests to voice assistant
    // Note: voiceHooks internally checks isVoiceSessionStarted() so we don't need to check voice.status here
    const prevRequestIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const requests = props.session.agentState?.requests ?? {}
        const currentIds = new Set(Object.keys(requests))

        for (const [requestId, request] of Object.entries(requests)) {
            if (!prevRequestIdsRef.current.has(requestId)) {
                voiceHooks.onPermissionRequested(
                    props.session.id,
                    requestId,
                    (request as { tool?: string }).tool ?? 'unknown',
                    (request as { arguments?: unknown }).arguments
                )
            }
        }

        prevRequestIdsRef.current = currentIds
    }, [props.session.agentState?.requests, props.session.id])

    const handleVoiceToggle = useCallback(async () => {
        if (!voice) return
        if (voice.status === 'connected' || voice.status === 'connecting') {
            await voice.stopVoice()
        } else {
            await voice.startVoice(props.session.id)
        }
    }, [voice, props.session.id])

    const handleVoiceMicToggle = useCallback(() => {
        if (!voice) return
        voice.toggleMic()
    }, [voice])

    // Track session id to clear caches when it changes
    const prevSessionIdRef = useRef<string | null>(null)

    useEffect(() => {
        normalizedCacheRef.current.clear()
        blocksByIdRef.current.clear()
    }, [props.session.id])

    // Draft persistence: save text on every change, keyed by current session
    const draftSessionIdRef = useRef<string>(props.session.id)
    const composerTextRef = useRef<string>('')

    draftSessionIdRef.current = props.session.id

    const handleComposerTextChange = useCallback((text: string) => {
        composerTextRef.current = text
        // Save draft on every text change (debounced by sessionStorage writes being cheap)
        saveDraft(draftSessionIdRef.current, { text, attachments: [] })
    }, [])

    const normalizedMessages: NormalizedMessage[] = useMemo(() => {
        // Clear caches immediately when session changes (before useEffect runs)
        if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== props.session.id) {
            normalizedCacheRef.current.clear()
            blocksByIdRef.current.clear()
        }
        prevSessionIdRef.current = props.session.id

        const cache = normalizedCacheRef.current
        const normalized: NormalizedMessage[] = []
        const seen = new Set<string>()
        for (const message of props.messages) {
            seen.add(message.id)
            const cached = cache.get(message.id)
            if (cached && cached.source === message) {
                if (cached.normalized) normalized.push(cached.normalized)
                continue
            }
            const next = normalizeDecryptedMessage(message)
            cache.set(message.id, { source: message, normalized: next })
            if (next) normalized.push(next)
        }
        for (const id of cache.keys()) {
            if (!seen.has(id)) {
                cache.delete(id)
            }
        }
        return normalized
    }, [props.messages])

    const reduced = useMemo(
        () => reduceChatBlocks(normalizedMessages, props.session.agentState),
        [normalizedMessages, props.session.agentState]
    )
    const reconciled = useMemo(
        () => reconcileChatBlocks(reduced.blocks, blocksByIdRef.current),
        [reduced.blocks]
    )
    const backgroundTasks = useMemo(
        () => mergeBackgroundTasks(
            props.session.backgroundTasks,
            extractHistoricalBackgroundTasks(reconciled.blocks, props.messages)
        ),
        [props.session.backgroundTasks, reconciled.blocks, props.messages]
    )

    useEffect(() => {
        blocksByIdRef.current = reconciled.byId
    }, [reconciled.byId])

    // Permission mode change handler
    const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
        try {
            await setPermissionMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set permission mode:', e)
        }
    }, [setPermissionMode, props.onRefresh, haptic])

    const handleCollaborationModeChange = useCallback(async (mode: CodexCollaborationMode) => {
        try {
            await setCollaborationMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set collaboration mode:', e)
        }
    }, [setCollaborationMode, props.onRefresh, haptic])

    // Model mode change handler
    const handleModelChange = useCallback(async (model: string | null) => {
        try {
            await setModel(model)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set model:', e)
        }
    }, [setModel, props.onRefresh, haptic])

    const handleModelReasoningEffortChange = useCallback(async (modelReasoningEffort: string | null) => {
        try {
            await setModelReasoningEffort(modelReasoningEffort)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set model reasoning effort:', e)
        }
    }, [setModelReasoningEffort, props.onRefresh, haptic])

    const handleEffortChange = useCallback(async (effort: string | null) => {
        try {
            await setEffort(effort)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set effort:', e)
        }
    }, [setEffort, props.onRefresh, haptic])

    // Abort handler
    const handleAbort = useCallback(async () => {
        await abortSession()
        props.onRefresh()
    }, [abortSession, props.onRefresh])

    // Switch to remote handler
    const handleSwitchToRemote = useCallback(async () => {
        await switchSession()
        props.onRefresh()
    }, [switchSession, props.onRefresh])

    const handleViewFiles = useCallback(() => {
        navigate({
            to: '/sessions/$sessionId/files',
            params: { sessionId: props.session.id }
        })
    }, [navigate, props.session.id])

    const handleViewTerminal = useCallback(() => {
        navigate({
            to: '/sessions/$sessionId/terminal',
            params: { sessionId: props.session.id }
        })
    }, [navigate, props.session.id])

    const handleSend = useCallback((text: string, attachments?: AttachmentMetadata[]) => {
        if (agentFlavor === 'codex') {
            const unsupportedCommand = findUnsupportedCodexBuiltinSlashCommand(
                text,
                props.availableSlashCommands ?? []
            )
            if (unsupportedCommand) {
                haptic.notification('error')
                addToast({
                    title: t('composer.codexSlashUnsupported.title'),
                    body: t('composer.codexSlashUnsupported.body', { command: `/${unsupportedCommand}` }),
                    sessionId: props.session.id,
                    url: `/sessions/${props.session.id}`
                })
                return
            }
        }

        props.onSend(text, attachments)
        clearDraft(props.session.id)
        setForceScrollToken((token) => token + 1)
    }, [agentFlavor, props.availableSlashCommands, props.onSend, props.session.id, addToast, haptic, t])

    // Always create the attachment adapter (even for inactive sessions) so that
    // the file picker button is functional and errors are visible in the UI
    // rather than silently swallowed. The server-side upload endpoint will reject
    // uploads for inactive sessions with an error, which the adapter surfaces as
    // an error-state attachment chip in the composer.
    const attachmentAdapter = useMemo(
        () => createAttachmentAdapter(props.api, props.session.id),
        [props.api, props.session.id]
    )

    const runtime = useHappyRuntime({
        session: props.session,
        blocks: reconciled.blocks,
        isSending: props.isSending,
        onSendMessage: handleSend,
        onAbort: handleAbort,
        attachmentAdapter,
        allowSendWhenInactive: true
    })

    const draft = loadDraft(props.session.id)
    const initialText = draft?.text ?? ''

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SessionHeader
                session={props.session}
                onBack={props.onBack}
                onViewFiles={props.session.metadata?.path ? handleViewFiles : undefined}
                api={props.api}
                onSessionDeleted={props.onBack}
            />

            {props.session.teamState && (
                <TeamPanel teamState={props.session.teamState} />
            )}

            {sessionInactive ? (
                <div className="px-3 pt-3">
                    <div className="mx-auto w-full max-w-content rounded-md bg-[var(--app-subtle-bg)] p-3 text-sm text-[var(--app-hint)]">
                        Session is inactive. Sending will resume it automatically.
                    </div>
                </div>
            ) : null}

            <AssistantRuntimeProvider runtime={runtime}>
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <HappyThread
                        key={props.session.id}
                        api={props.api}
                        sessionId={props.session.id}
                        metadata={props.session.metadata}
                        disabled={sessionInactive}
                        onRefresh={props.onRefresh}
                        onRetryMessage={props.onRetryMessage}
                        onFlushPending={props.onFlushPending}
                        onAtBottomChange={props.onAtBottomChange}
                        isLoadingMessages={props.isLoadingMessages}
                        messagesWarning={props.messagesWarning}
                        hasMoreMessages={props.hasMoreMessages}
                        isLoadingMoreMessages={props.isLoadingMoreMessages}
                        onLoadMore={props.onLoadMore}
                        pendingCount={props.pendingCount}
                        rawMessagesCount={props.messages.length}
                        normalizedMessagesCount={normalizedMessages.length}
                        messagesVersion={props.messagesVersion}
                        forceScrollToken={forceScrollToken}
                    />

                    <HappyComposer
                        key={props.session.id}
                        sessionId={props.session.id}
                        disabled={props.isSending}
                        todos={props.session.todos}
                        permissionMode={props.session.permissionMode}
                        collaborationMode={codexCollaborationModeSupported ? props.session.collaborationMode : undefined}
                        model={props.session.model}
                        modelOptions={getModelOptions(agentFlavor)}
                        modelReasoningEffort={agentFlavor === 'codex' ? props.session.modelReasoningEffort : undefined}
                        effort={props.session.effort}
                        agentFlavor={agentFlavor}
                        active={props.session.active}
                        allowSendWhenInactive
                        thinking={mainTurnRunning}
                        agentState={props.session.agentState}
                        backgroundTaskCount={props.session.backgroundTaskCount}
                        backgroundTasks={backgroundTasks}
                        readBackgroundTaskOutput={readBackgroundTaskOutput}
                        chatContext={{
                            api: props.api,
                            sessionId: props.session.id,
                            metadata: props.session.metadata,
                            disabled: sessionInactive,
                            onRefresh: props.onRefresh,
                            onRetryMessage: props.onRetryMessage
                        }}
                        contextSize={reduced.latestUsage?.contextSize}
                        controlledByUser={controlledByUser}
                        onCollaborationModeChange={
                            codexCollaborationModeSupported && props.session.active && !controlledByUser
                                ? handleCollaborationModeChange
                                : undefined
                        }
                        onPermissionModeChange={handlePermissionModeChange}
                        onModelChange={handleModelChange}
                        onModelReasoningEffortChange={
                            agentFlavor === 'codex' && props.session.active && !controlledByUser
                                ? handleModelReasoningEffortChange
                                : undefined
                        }
                        onEffortChange={handleEffortChange}
                        onSwitchToRemote={handleSwitchToRemote}
                        onTerminal={terminalSupported ? handleViewTerminal : undefined}
                        terminalUnsupported={!terminalSupported}
                        autocompleteSuggestions={props.autocompleteSuggestions}
                        voiceStatus={voice?.status}
                        voiceMicMuted={voice?.micMuted}
                        onVoiceToggle={voice ? handleVoiceToggle : undefined}
                        onVoiceMicToggle={voice ? handleVoiceMicToggle : undefined}
                        onQueuedSend={handleSend}
                        initialText={initialText}
                        onTextChange={handleComposerTextChange}
                    />
                </div>
            </AssistantRuntimeProvider>

            {/* Voice session component - renders nothing but initializes ElevenLabs */}
            {voice && (
                <RealtimeVoiceSession
                    api={props.api}
                    micMuted={voice.micMuted}
                    onStatusChange={voice.setStatus}
                />
            )}
        </div>
    )
}

type BackgroundTask = NonNullable<Session['backgroundTasks']>[number]

function mergeBackgroundTasks(
    current: Session['backgroundTasks'],
    historical: BackgroundTask[]
): BackgroundTask[] {
    if (!current || current.length === 0) return historical

    const seen = new Set(current.flatMap(task => [task.id, task.toolUseId]))
    return [
        ...current.map(task => {
            const match = historical.find(h => h.id === task.id || h.toolUseId === task.toolUseId)
            if (!match) return task
            return {
                ...task,
                description: task.description ?? match.description,
                prompt: task.prompt ?? match.prompt,
                subagentType: task.subagentType ?? match.subagentType,
                command: task.command ?? match.command,
                summary: task.summary ?? match.summary,
                outputFile: task.outputFile ?? match.outputFile,
            }
        }),
        ...historical.filter(task => !seen.has(task.id) && !seen.has(task.toolUseId))
    ]
}

function extractHistoricalBackgroundTasks(blocks: ChatBlock[], messages: DecryptedMessage[]): BackgroundTask[] {
    const tasks: BackgroundTask[] = []

    for (const block of blocks) {
        if (block.kind !== 'tool-call') continue
        collectBackgroundAgentTask(block, tasks)
    }

    collectCodexSummaryTasks(messages, tasks)

    return tasks
}

function collectCodexSummaryTasks(messages: DecryptedMessage[], tasks: BackgroundTask[]): void {
    let summaryCountInTurn = 0
    let lastUserPrompt: string | undefined

    for (const message of messages) {
        const userText = getWebUserText(message.content)
        if (userText !== null) {
            summaryCountInTurn = 0
            lastUserPrompt = userText.slice(0, 500)
            continue
        }

        const summary = getCodexSummary(message.content)
        if (!summary) continue

        summaryCountInTurn += 1
        if (summaryCountInTurn === 1) continue

        tasks.push({
            id: `codex:${summary.leafUuid}`,
            toolUseId: summary.leafUuid,
            type: 'agent',
            description: summary.text,
            prompt: lastUserPrompt,
            status: 'completed',
            startedAt: message.createdAt,
            completedAt: message.createdAt,
        })
    }
}

function getWebUserText(content: unknown): string | null {
    if (!isRecord(content) || content.role !== 'user') return null
    const body = isRecord(content.content) ? content.content : null
    return body?.type === 'text' && typeof body.text === 'string' ? body.text : null
}

function getCodexSummary(content: unknown): { text: string; leafUuid: string } | null {
    if (!isRecord(content) || content.role !== 'agent') return null
    const envelope = isRecord(content.content) ? content.content : null
    if (envelope?.type !== 'output') return null
    const data = isRecord(envelope.data) ? envelope.data : null
    if (data?.type !== 'summary') return null

    const text = typeof data.summary === 'string' ? data.summary.trim() : ''
    const leafUuid = typeof data.leafUuid === 'string' ? data.leafUuid : ''
    return text && leafUuid ? { text, leafUuid } : null
}

function collectBackgroundAgentTask(block: ToolCallBlock, tasks: BackgroundTask[]): void {
    if (block.tool.name === 'Agent') {
        const input = isRecord(block.tool.input) ? block.tool.input : null
        const agentId = extractAgentId(block.tool.result)
        if (input?.run_in_background === true || agentId) {
            tasks.push({
                id: agentId ?? `history:${block.id}`,
                toolUseId: block.tool.id,
                type: 'agent',
                description: typeof input?.description === 'string' ? input.description : block.tool.description ?? undefined,
                prompt: typeof input?.prompt === 'string' ? input.prompt.slice(0, 500) : undefined,
                subagentType: typeof input?.subagent_type === 'string' ? input.subagent_type : undefined,
                status: 'completed',
                startedAt: block.tool.startedAt ?? block.createdAt,
                completedAt: block.tool.completedAt ?? block.createdAt,
            })
        }
    }

    for (const child of block.children) {
        if (child.kind === 'tool-call') collectBackgroundAgentTask(child, tasks)
    }
}

function extractAgentId(result: unknown): string | null {
    if (typeof result !== 'string') return null
    return result.match(/agentId:\s*([^\s)]+)/)?.[1] ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}
