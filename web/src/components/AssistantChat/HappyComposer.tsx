import { getCodexCollaborationModeOptions, getPermissionModeOptionsForFlavor } from '@hapi/protocol'
import type { ModelOption } from '@hapi/protocol'
import { ComposerPrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import {
    type ChangeEvent as ReactChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type FormEvent as ReactFormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type SyntheticEvent as ReactSyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import type { AgentState, CodexCollaborationMode, PermissionMode, Session } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import type { ConversationStatus } from '@/realtime/types'
import { useActiveWord } from '@/hooks/useActiveWord'
import { useActiveSuggestions } from '@/hooks/useActiveSuggestions'
import { applySuggestion } from '@/utils/applySuggestion'
import { usePlatform } from '@/hooks/usePlatform'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { supportsEffort, supportsModelChange } from '@hapi/protocol'
import { markSkillUsed } from '@/lib/recent-skills'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import type { TodoItem } from '@hapi/protocol'
import { StatusBar } from '@/components/AssistantChat/StatusBar'
import { ComposerButtons } from '@/components/AssistantChat/ComposerButtons'
import { ComposerIndicators, type TodoProgress, type PanelKey } from '@/components/AssistantChat/ComposerIndicators'
import { TodoDetailWindow } from '@/components/AssistantChat/TodoDetailWindow'
import { BackgroundDetailWindow } from '@/components/AssistantChat/BackgroundDetailWindow'
import type { HappyChatContextValue } from '@/components/AssistantChat/context'
import { AttachmentItem } from '@/components/AssistantChat/AttachmentItem'
import { useTranslation } from '@/lib/use-translation'
import type { AttachmentMetadata } from '@/types/api'
import { makeClientSideId } from '@/lib/messages'
import { getModelOptionsForFlavor, getNextModelForFlavor } from './modelOptions'
import { getClaudeComposerEffortOptions } from './claudeEffortOptions'
import { getCodexComposerReasoningEffortOptions } from './codexReasoningEffortOptions'
import { extractQueuedAttachments, type QueuedComposerMessage } from './queuedMessages'
import { getQueuedMessages, setQueuedMessages as saveQueuedMessages, clearQueuedMessages } from './queuedMessagesStore'

export interface TextInputState {
    text: string
    selection: { start: number; end: number }
}

const defaultSuggestionHandler = async (): Promise<Suggestion[]> => []

function PaperclipIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    )
}

function QueueXIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
    )
}

export function HappyComposer(props: {
    sessionId: string
    disabled?: boolean
    todos?: TodoItem[]
    permissionMode?: PermissionMode
    collaborationMode?: CodexCollaborationMode
    model?: string | null
    modelOptions?: ModelOption[]
    modelReasoningEffort?: string | null
    effort?: string | null
    active?: boolean
    allowSendWhenInactive?: boolean
    thinking?: boolean
    agentState?: AgentState | null
    backgroundTaskCount?: number
    backgroundTasks?: Session['backgroundTasks']
    readBackgroundTaskOutput?: (taskId: string) => Promise<unknown[]>
    chatContext?: HappyChatContextValue
    contextSize?: number
    controlledByUser?: boolean
    agentFlavor?: string | null
    onCollaborationModeChange?: (mode: CodexCollaborationMode) => void
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelChange?: (model: string | null) => void
    onModelReasoningEffortChange?: (modelReasoningEffort: string | null) => void
    onEffortChange?: (effort: string | null) => void
    onSwitchToRemote?: () => void
    onTerminal?: () => void
    terminalUnsupported?: boolean
    autocompletePrefixes?: string[]
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    // Voice assistant props
    voiceStatus?: ConversationStatus
    voiceMicMuted?: boolean
    onVoiceToggle?: () => void
    onVoiceMicToggle?: () => void
    onQueuedSend?: (text: string, attachments?: AttachmentMetadata[]) => void
    initialText?: string
    onTextChange?: (text: string) => void
}) {
    const { t } = useTranslation()
    const {
        disabled = false,
        permissionMode: rawPermissionMode,
        collaborationMode: rawCollaborationMode,
        model: rawModel,
        modelOptions,
        modelReasoningEffort: rawModelReasoningEffort,
        effort: rawEffort,
        active = true,
        allowSendWhenInactive = false,
        thinking = false,
        agentState,
        backgroundTaskCount,
        contextSize,
        controlledByUser = false,
        agentFlavor,
        onCollaborationModeChange,
        onPermissionModeChange,
        onModelChange,
        onModelReasoningEffortChange,
        onEffortChange,
        onSwitchToRemote,
        onTerminal,
        terminalUnsupported = false,
        autocompletePrefixes = ['@', '/'],
        autocompleteSuggestions = defaultSuggestionHandler,
        voiceStatus = 'disconnected',
        voiceMicMuted = false,
        onVoiceToggle,
        onVoiceMicToggle,
        onQueuedSend
    } = props

    // Use ?? so missing values fall back to default (destructuring defaults only handle undefined)
    const permissionMode = rawPermissionMode ?? 'default'
    const collaborationMode = rawCollaborationMode ?? 'default'
    const model = rawModel ?? null
    const modelReasoningEffort = rawModelReasoningEffort ?? null
    const effort = rawEffort ?? null

    const [openPanels, setOpenPanels] = useState<Set<PanelKey>>(new Set())
    const togglePanel = (key: PanelKey) => {
        setOpenPanels(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const todoProgress: TodoProgress = useMemo(() => {
        if (!props.todos || props.todos.length === 0) return null
        const completed = props.todos.filter(t => t.status === 'completed').length
        return { items: props.todos, completed, total: props.todos.length }
    }, [props.todos])
    const backgroundAgentTasks = useMemo(
        () => (props.backgroundTasks ?? []).filter(t => t.type === 'agent'),
        [props.backgroundTasks]
    )
    const backgroundShellTasks = useMemo(
        () => (props.backgroundTasks ?? []).filter(t => t.type === 'shell'),
        [props.backgroundTasks]
    )

    const api = useAssistantApi()
    const composerText = useAssistantState(({ composer }) => composer.text)
    const attachments = useAssistantState(({ composer }) => composer.attachments)
    const threadIsDisabled = useAssistantState(({ thread }) => thread.isDisabled)

    // Set initial text on mount
    useEffect(() => {
        if (props.initialText) {
            api.composer().setText(props.initialText)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Report text changes to parent
    useEffect(() => {
        props.onTextChange?.(composerText)
    }, [composerText, props.onTextChange])

    const controlsDisabled = disabled || (!active && !allowSendWhenInactive) || threadIsDisabled
    const trimmed = composerText.trim()
    const hasText = trimmed.length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsReady = !hasAttachments || attachments.every((attachment) => {
        if (attachment.status.type === 'complete') {
            return true
        }
        if (attachment.status.type !== 'requires-action') {
            return false
        }
        const path = (attachment as { path?: string }).path
        return typeof path === 'string' && path.length > 0
    })
    const mainTurnRunning = Boolean(thinking)
    const hasRunningBackgroundTasks = (backgroundTaskCount ?? 0) > 0
    const canAbortRun = mainTurnRunning || hasRunningBackgroundTasks
    const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && !mainTurnRunning
    const canQueue = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled && mainTurnRunning

    const [inputState, setInputState] = useState<TextInputState>({
        text: '',
        selection: { start: 0, end: 0 }
    })
    const [showSettings, setShowSettings] = useState(false)
    const [customModelText, setCustomModelText] = useState('')
    const [isAborting, setIsAborting] = useState(false)
    const [isSwitching, setIsSwitching] = useState(false)
    const [showContinueHint, setShowContinueHint] = useState(false)
    const [queuedMessages, setQueuedMessages] = useState<QueuedComposerMessage[]>(
        () => getQueuedMessages(props.sessionId)
    )

    // Sync queued messages to sessionStorage whenever they change
    useEffect(() => {
        if (queuedMessages.length === 0) {
            clearQueuedMessages(props.sessionId)
        } else {
            saveQueuedMessages(props.sessionId, queuedMessages)
        }
    }, [props.sessionId, queuedMessages])

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevControlledByUser = useRef(controlledByUser)
    const queueDispatchInFlightRef = useRef(false)

    useEffect(() => {
        setInputState((prev) => {
            if (prev.text === composerText) return prev
            // When syncing from composerText, update selection to end of text
            // This ensures activeWord detection works correctly
            const newPos = composerText.length
            return { text: composerText, selection: { start: newPos, end: newPos } }
        })
    }, [composerText])

    // Track one-time "continue" hint after switching from local to remote.
    useEffect(() => {
        if (prevControlledByUser.current === true && controlledByUser === false) {
            setShowContinueHint(true)
        }
        if (controlledByUser) {
            setShowContinueHint(false)
        }
        prevControlledByUser.current = controlledByUser
    }, [controlledByUser])

    const { haptic: platformHaptic, isTouch } = usePlatform()
    const { isStandalone, isIOS } = usePWAInstall()
    const isIOSPWA = isIOS && isStandalone
    const bottomPaddingClass = isIOSPWA ? 'pb-0' : 'pb-3'
    const activeWord = useActiveWord(inputState.text, inputState.selection, autocompletePrefixes)
    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeWord,
        autocompleteSuggestions,
        { clampSelection: true, wrapAround: true }
    )

    const haptic = useCallback((type: 'light' | 'success' | 'error' = 'light') => {
        if (type === 'light') {
            platformHaptic.impact('light')
        } else if (type === 'success') {
            platformHaptic.notification('success')
        } else {
            platformHaptic.notification('error')
        }
    }, [platformHaptic])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (!suggestion || !textareaRef.current) return
        if (suggestion.source === 'skill') {
            markSkillUsed(suggestion.text.replace(/^\//, ''))
        }

        // For Codex user prompts with content, expand the content instead of command name
        let textToInsert = suggestion.text
        let addSpace = true
        if (agentFlavor === 'codex' && suggestion.source !== 'builtin' && suggestion.content) {
            textToInsert = suggestion.content
            addSpace = false
        }

        const result = applySuggestion(
            inputState.text,
            inputState.selection,
            textToInsert,
            autocompletePrefixes,
            addSpace
        )

        api.composer().setText(result.text)
        setInputState({
            text: result.text,
            selection: { start: result.cursorPosition, end: result.cursorPosition }
        })

        setTimeout(() => {
            const el = textareaRef.current
            if (!el) return
            el.setSelectionRange(result.cursorPosition, result.cursorPosition)
            try {
                el.focus({ preventScroll: true })
            } catch {
                el.focus()
            }
        }, 0)

        haptic('light')
    }, [api, suggestions, inputState, autocompletePrefixes, haptic, agentFlavor])

    const abortDisabled = controlsDisabled || isAborting || !canAbortRun
    const switchDisabled = controlsDisabled || isSwitching || !controlledByUser
    const showSwitchButton = Boolean(controlledByUser && onSwitchToRemote)
    const showTerminalButton = Boolean(onTerminal || terminalUnsupported)
    const terminalDisabled = controlsDisabled || terminalUnsupported || !active
    const terminalLabel = terminalUnsupported ? t('terminal.unsupportedWindows') : t('composer.terminal')

    useEffect(() => {
        if (!isAborting) return
        if (canAbortRun) return
        setIsAborting(false)
    }, [canAbortRun, isAborting])

    useEffect(() => {
        if (!isSwitching) return
        if (controlledByUser) return
        setIsSwitching(false)
    }, [isSwitching, controlledByUser])

    const handleAbort = useCallback(() => {
        if (abortDisabled) return
        haptic('error')
        setIsAborting(true)
        api.thread().cancelRun()
    }, [abortDisabled, api, haptic])

    const clearComposer = useCallback(async () => {
        api.composer().setText('')
        try {
            await api.composer().clearAttachments()
        } catch {
            // Best effort
        }
    }, [api])

    const enqueueCurrentComposer = useCallback(async () => {
        if (!canQueue) return

        const nextAttachments = hasAttachments ? extractQueuedAttachments(attachments) : []
        const nextQueuedMessage: QueuedComposerMessage = {
            id: makeClientSideId('queued'),
            text: composerText,
            attachments: nextAttachments.length > 0 ? nextAttachments : undefined
        }

        setQueuedMessages((current) => [...current, nextQueuedMessage])
        await clearComposer()
        setShowContinueHint(false)
        haptic('success')
    }, [attachments, canQueue, clearComposer, composerText, hasAttachments, haptic])

    const removeQueuedMessage = useCallback((id: string) => {
        setQueuedMessages((current) => current.filter((message) => message.id !== id))
    }, [])

    const handleSwitch = useCallback(async () => {
        if (switchDisabled || !onSwitchToRemote) return
        haptic('light')
        setIsSwitching(true)
        try {
            await onSwitchToRemote()
        } catch {
            setIsSwitching(false)
        }
    }, [switchDisabled, onSwitchToRemote, haptic])

    const permissionModeOptions = useMemo(
        () => getPermissionModeOptionsForFlavor(agentFlavor),
        [agentFlavor]
    )
    const collaborationModeOptions = useMemo(
        () => agentFlavor === 'codex' ? getCodexCollaborationModeOptions() : [],
        [agentFlavor]
    )
    const claudeModelOptions = useMemo(
        () => getModelOptionsForFlavor(agentFlavor, model, modelOptions),
        [agentFlavor, model, modelOptions]
    )
    const codexReasoningEffortOptions = useMemo(
        () => agentFlavor === 'codex' ? getCodexComposerReasoningEffortOptions(modelReasoningEffort) : [],
        [agentFlavor, modelReasoningEffort]
    )
    const claudeEffortOptions = useMemo(
        () => getClaudeComposerEffortOptions(effort),
        [effort]
    )
    const permissionModes = useMemo(
        () => permissionModeOptions.map((option) => option.mode),
        [permissionModeOptions]
    )

    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        const key = e.key

        // Avoid intercepting IME composition keystrokes (Enter, arrows, etc.)
        if (e.nativeEvent.isComposing) {
            return
        }

        // Ctrl/Cmd+Enter: send when idle, queue when running (checked before suggestions)
        if (key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (canSend) {
                api.composer().send()
                setShowContinueHint(false)
                return
            }
            if (canQueue) {
                void enqueueCurrentComposer()
            }
            setShowContinueHint(false)
            return
        }

        // Enter with suggestions visible: select the suggestion
        if (key === 'Enter' && suggestions.length > 0) {
            e.preventDefault()
            const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
            handleSuggestionSelect(indexToSelect)
            return
        }

        if (suggestions.length > 0) {
            if (key === 'ArrowUp') {
                e.preventDefault()
                moveUp()
                return
            }
            if (key === 'ArrowDown') {
                e.preventDefault()
                moveDown()
                return
            }
            if ((key === 'Tab') && !e.shiftKey) {
                e.preventDefault()
                const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
                handleSuggestionSelect(indexToSelect)
                return
            }
            if (key === 'Escape') {
                e.preventDefault()
                clearSuggestions()
                return
            }
        }

        if (key === 'Escape' && canAbortRun) {
            e.preventDefault()
            handleAbort()
            return
        }

        if (key === 'Tab' && e.shiftKey && onPermissionModeChange && permissionModes.length > 0) {
            e.preventDefault()
            const currentIndex = permissionModes.indexOf(permissionMode)
            const nextIndex = (currentIndex + 1) % permissionModes.length
            const nextMode = permissionModes[nextIndex] ?? 'default'
            onPermissionModeChange(nextMode)
            haptic('light')
        }
    }, [
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        handleSuggestionSelect,
        canAbortRun,
        handleAbort,
        onPermissionModeChange,
        permissionMode,
        permissionModes,
        canSend,
        canQueue,
        api,
        enqueueCurrentComposer,
        haptic
    ])

    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'm' && (e.metaKey || e.ctrlKey) && onModelChange && supportsModelChange(agentFlavor)) {
                e.preventDefault()
                onModelChange(getNextModelForFlavor(agentFlavor, model, modelOptions))
                haptic('light')
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [model, modelOptions, onModelChange, haptic, agentFlavor])

    const handleChange = useCallback((e: ReactChangeEvent<HTMLTextAreaElement>) => {
        const selection = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        }
        setInputState({ text: e.target.value, selection })
    }, [])

    const handleSelect = useCallback((e: ReactSyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement
        setInputState(prev => ({
            ...prev,
            selection: { start: target.selectionStart, end: target.selectionEnd }
        }))
    }, [])

    const handlePaste = useCallback(async (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData?.files || [])
        const imageFiles = files.filter(file => file.type.startsWith('image/'))

        if (imageFiles.length === 0) return

        e.preventDefault()

        try {
            for (const file of imageFiles) {
                await api.composer().addAttachment(file)
            }
        } catch (error) {
            console.error('Error adding pasted image:', error)
        }
    }, [api])

    const handleSettingsToggle = useCallback(() => {
        haptic('light')
        setShowSettings(prev => !prev)
    }, [haptic])

    const handleSubmit = useCallback((event?: ReactFormEvent<HTMLFormElement>) => {
        if (event && !attachmentsReady) {
            event.preventDefault()
            return
        }
        setShowContinueHint(false)
    }, [attachmentsReady])

    const handlePermissionChange = useCallback((mode: PermissionMode) => {
        if (!onPermissionModeChange || controlsDisabled) return
        onPermissionModeChange(mode)
        setShowSettings(false)
        haptic('light')
    }, [onPermissionModeChange, controlsDisabled, haptic])

    const handleCollaborationChange = useCallback((mode: CodexCollaborationMode) => {
        if (!onCollaborationModeChange || controlsDisabled) return
        onCollaborationModeChange(mode)
        setShowSettings(false)
        haptic('light')
    }, [onCollaborationModeChange, controlsDisabled, haptic])

    const handleModelChange = useCallback((nextModel: string | null) => {
        if (!onModelChange || controlsDisabled) return
        onModelChange(nextModel)
        setShowSettings(false)
        haptic('light')
    }, [onModelChange, controlsDisabled, haptic])

    const handleCustomModelSubmit = useCallback((event: ReactFormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const nextModel = customModelText.trim()
        if (!nextModel) return
        handleModelChange(nextModel)
    }, [customModelText, handleModelChange])

    const handleModelReasoningEffortChange = useCallback((nextModelReasoningEffort: string | null) => {
        if (!onModelReasoningEffortChange || controlsDisabled) return
        onModelReasoningEffortChange(nextModelReasoningEffort)
        setShowSettings(false)
        haptic('light')
    }, [onModelReasoningEffortChange, controlsDisabled, haptic])

    const handleEffortChange = useCallback((nextEffort: string | null) => {
        if (!onEffortChange || controlsDisabled) return
        onEffortChange(nextEffort)
        setShowSettings(false)
        haptic('light')
    }, [onEffortChange, controlsDisabled, haptic])

    const showCollaborationSettings = Boolean(onCollaborationModeChange && collaborationModeOptions.length > 0)
    const showPermissionSettings = Boolean(onPermissionModeChange && permissionModeOptions.length > 0)
    const showModelSettings = Boolean(onModelChange && supportsModelChange(agentFlavor))
    const showModelReasoningEffortSettings = Boolean(onModelReasoningEffortChange && codexReasoningEffortOptions.length > 0)
    const showEffortSettings = Boolean(onEffortChange && supportsEffort(agentFlavor))
    const showSettingsButton = Boolean(
        showCollaborationSettings
        || showPermissionSettings
        || showModelSettings
        || showModelReasoningEffortSettings
        || showEffortSettings
    )
    const showAbortButton = true
    const handleSend = useCallback(() => {
        if (canSend) {
            api.composer().send()
            return
        }
        if (canQueue) {
            void enqueueCurrentComposer()
        }
    }, [api, canQueue, canSend, enqueueCurrentComposer])

    useEffect(() => {
        if (mainTurnRunning) {
            queueDispatchInFlightRef.current = false
            return
        }
        if (!onQueuedSend || controlsDisabled || queueDispatchInFlightRef.current) {
            return
        }
        const nextQueuedMessage = queuedMessages[0]
        if (!nextQueuedMessage) {
            return
        }

        queueDispatchInFlightRef.current = true
        setQueuedMessages((current) => current.slice(1))
        onQueuedSend(nextQueuedMessage.text, nextQueuedMessage.attachments)
    }, [controlsDisabled, mainTurnRunning, onQueuedSend, queuedMessages])

    const overlays = useMemo(() => {
        if (showSettings && (showCollaborationSettings || showPermissionSettings || showModelSettings || showModelReasoningEffortSettings || showEffortSettings)) {
            return (
                <div className="absolute bottom-[100%] mb-2 w-full">
                    <FloatingOverlay maxHeight={320}>
                        {showCollaborationSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                    {t('misc.collaborationMode')}
                                </div>
                                {collaborationModeOptions.map((option) => (
                                    <button
                                        key={option.mode}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                        }`}
                                        onClick={() => handleCollaborationChange(option.mode)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                collaborationMode === option.mode
                                                    ? 'border-[var(--app-link)]'
                                                    : 'border-[var(--app-hint)]'
                                            }`}
                                        >
                                            {collaborationMode === option.mode && (
                                                <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                            )}
                                        </div>
                                        <span className={collaborationMode === option.mode ? 'text-[var(--app-link)]' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {showCollaborationSettings && (showPermissionSettings || showModelSettings || showModelReasoningEffortSettings || showEffortSettings) ? (
                            <div className="mx-3 h-px bg-[var(--app-divider)]" />
                        ) : null}

                        {showPermissionSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                    {t('misc.permissionMode')}
                                </div>
                                {permissionModeOptions.map((option) => (
                                    <button
                                        key={option.mode}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                        }`}
                                        onClick={() => handlePermissionChange(option.mode)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                permissionMode === option.mode
                                                    ? 'border-[var(--app-link)]'
                                                    : 'border-[var(--app-hint)]'
                                            }`}
                                        >
                                            {permissionMode === option.mode && (
                                                <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                            )}
                                        </div>
                                        <span className={permissionMode === option.mode ? 'text-[var(--app-link)]' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {(showCollaborationSettings || showPermissionSettings) && (showModelSettings || showModelReasoningEffortSettings || showEffortSettings) ? (
                            <div className="mx-3 h-px bg-[var(--app-divider)]" />
                        ) : null}

                        {showModelSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                    {t('misc.model')}
                                </div>
                                {claudeModelOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'auto'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                        }`}
                                        onClick={() => handleModelChange(option.value)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                model === option.value
                                                    ? 'border-[var(--app-link)]'
                                                    : 'border-[var(--app-hint)]'
                                            }`}
                                        >
                                            {model === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                            )}
                                        </div>
                                        <span className={model === option.value ? 'text-[var(--app-link)]' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                                <form
                                    className="flex gap-2 px-3 py-2"
                                    onSubmit={handleCustomModelSubmit}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <input
                                        value={customModelText}
                                        onChange={(e) => setCustomModelText(e.target.value)}
                                        disabled={controlsDisabled}
                                        placeholder="gpt-..."
                                        className="min-w-0 flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 text-sm text-[var(--app-fg)] outline-none focus:ring-1 focus:ring-[var(--app-link)] disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={controlsDisabled || !customModelText.trim()}
                                        className="rounded-md px-2 py-1.5 text-sm text-[var(--app-link)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {t('button.apply')}
                                    </button>
                                </form>
                            </div>
                        ) : null}

                        {(showModelSettings || showModelReasoningEffortSettings) && showEffortSettings ? (
                            <div className="mx-3 h-px bg-[var(--app-divider)]" />
                        ) : null}

                        {showModelReasoningEffortSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                    {t('misc.reasoningEffort')}
                                </div>
                                {codexReasoningEffortOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'default'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                        }`}
                                        onClick={() => handleModelReasoningEffortChange(option.value)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                modelReasoningEffort === option.value
                                                    ? 'border-[var(--app-link)]'
                                                    : 'border-[var(--app-hint)]'
                                            }`}
                                        >
                                            {modelReasoningEffort === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                            )}
                                        </div>
                                        <span className={modelReasoningEffort === option.value ? 'text-[var(--app-link)]' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {showModelReasoningEffortSettings && showEffortSettings ? (
                            <div className="mx-3 h-px bg-[var(--app-divider)]" />
                        ) : null}

                        {showEffortSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-[var(--app-hint)]">
                                    {t('misc.effort')}
                                </div>
                                {claudeEffortOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'auto'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-[var(--app-secondary-bg)]'
                                        }`}
                                        onClick={() => handleEffortChange(option.value)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                effort === option.value
                                                    ? 'border-[var(--app-link)]'
                                                    : 'border-[var(--app-hint)]'
                                            }`}
                                        >
                                            {effort === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-[var(--app-link)]" />
                                            )}
                                        </div>
                                        <span className={effort === option.value ? 'text-[var(--app-link)]' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </FloatingOverlay>
                </div>
            )
        }

        if (suggestions.length > 0) {
            return (
                <div className="absolute bottom-[100%] mb-2 w-full">
                    <FloatingOverlay>
                        <Autocomplete
                            suggestions={suggestions}
                            selectedIndex={selectedIndex}
                            onSelect={(index) => handleSuggestionSelect(index)}
                        />
                    </FloatingOverlay>
                </div>
            )
        }

        return null
    }, [
        showSettings,
        showCollaborationSettings,
        showPermissionSettings,
        showModelSettings,
        showModelReasoningEffortSettings,
        showEffortSettings,
        claudeModelOptions,
        codexReasoningEffortOptions,
        claudeEffortOptions,
        suggestions,
        selectedIndex,
        controlsDisabled,
        collaborationMode,
        permissionMode,
        model,
        modelReasoningEffort,
        effort,
        collaborationModeOptions,
        permissionModeOptions,
        customModelText,
        handleCollaborationChange,
        handlePermissionChange,
        handleModelChange,
        handleCustomModelSubmit,
        handleModelReasoningEffortChange,
        handleEffortChange,
        handleSuggestionSelect,
        t
    ])

    return (
        <div className={`px-3 ${bottomPaddingClass} pt-2 bg-[var(--app-bg)]`}>
            <div className="mx-auto w-full">
                <ComposerPrimitive.Root className="relative" onSubmit={handleSubmit}>
                    {overlays}

                    <StatusBar
                        active={active}
                        thinking={thinking}
                        agentState={agentState}
                        backgroundTaskCount={backgroundTaskCount}
                        contextSize={contextSize}
                        model={model}
                        permissionMode={permissionMode}
                        collaborationMode={collaborationMode}
                        agentFlavor={agentFlavor}
                    />

                    {queuedMessages.length > 0 ? (
                        <div className="mb-2 flex flex-col gap-2">
                            {queuedMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]"
                                    style={{ maxWidth: '85%' }}
                                >
                                    {message.attachments && message.attachments.length > 0 ? (
                                        <div className="flex items-center gap-1 px-4 pt-2.5 text-[11px] text-[var(--app-hint)]">
                                            <PaperclipIcon className="h-3 w-3" />
                                            <span>{message.attachments.length} {message.attachments.length === 1 ? 'file' : 'files'}</span>
                                        </div>
                                    ) : null}
                                    <div className="flex items-start gap-2 px-4 py-3">
                                        <div className="min-w-0 flex-1 max-h-20 overflow-hidden whitespace-pre-wrap break-words text-base leading-snug text-[var(--app-fg)]" style={{ maskImage: message.text.length > 200 ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined, WebkitMaskImage: message.text.length > 200 ? 'linear-gradient(to bottom, black 70%, transparent 100%)' : undefined }}>
                                            {message.text.trim() || t('composer.queueAttachmentOnly')}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeQueuedMessage(message.id)}
                                            className="shrink-0 mt-0.5 rounded-full p-0.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                                            aria-label={t('composer.queueRemove')}
                                        >
                                            <QueueXIcon className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]">
                        {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <ComposerPrimitive.Attachments components={{ Attachment: AttachmentItem }} />
                            </div>
                        ) : null}

                        <div className="flex items-center px-4 py-3">
                            <ComposerPrimitive.Input
                                ref={textareaRef}
                                autoFocus={!controlsDisabled && !isTouch}
                                placeholder={showContinueHint ? t('misc.typeMessage') : t('misc.typeAMessage')}
                                disabled={controlsDisabled}
                                maxRows={5}
                                submitOnEnter={false}
                                cancelOnEscape={false}
                                onChange={handleChange}
                                onSelect={handleSelect}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                className="flex-1 resize-none bg-transparent text-base leading-snug text-[var(--app-fg)] placeholder-[var(--app-hint)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <ComposerButtons
                            canSend={canSend}
                            canQueue={canQueue}
                            controlsDisabled={controlsDisabled}
                            showSettingsButton={showSettingsButton}
                            onSettingsToggle={handleSettingsToggle}
                            showTerminalButton={showTerminalButton}
                            terminalDisabled={terminalDisabled}
                            terminalLabel={terminalLabel}
                            onTerminal={onTerminal ?? (() => {})}
                            showAbortButton={showAbortButton}
                            abortDisabled={abortDisabled}
                            isAborting={isAborting}
                            onAbort={handleAbort}
                            showSwitchButton={showSwitchButton}
                            switchDisabled={switchDisabled}
                            isSwitching={isSwitching}
                            onSwitch={handleSwitch}
                            onSend={handleSend}
                        >
                            <ComposerIndicators
                                todoProgress={todoProgress}
                                backgroundTaskCount={backgroundTaskCount ?? 0}
                                backgroundAgentCount={backgroundAgentTasks.length}
                                backgroundShellCount={backgroundShellTasks.length}
                                openPanels={openPanels}
                                onTogglePanel={togglePanel}
                            />
                        </ComposerButtons>
                    </div>

                    {openPanels.has('todos') && todoProgress ? (
                        <TodoDetailWindow progress={todoProgress} />
                    ) : null}
                    {openPanels.has('agents') && backgroundAgentTasks.length > 0 ? (
                        <BackgroundDetailWindow
                            tasks={backgroundAgentTasks}
                            panelType="agents"
                            readOutput={props.readBackgroundTaskOutput}
                            chatContext={props.chatContext}
                            onKillTask={(id) => { /* TODO: wire to RPC */ console.log('kill agent', id) }}
                        />
                    ) : null}
                    {openPanels.has('shells') && backgroundShellTasks.length > 0 ? (
                        <BackgroundDetailWindow
                            tasks={backgroundShellTasks}
                            panelType="shells"
                            onKillTask={(id) => { /* TODO: wire to RPC */ console.log('kill shell', id) }}
                        />
                    ) : null}
                </ComposerPrimitive.Root>
            </div>
        </div>
    )
}
