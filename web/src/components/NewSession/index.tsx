import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ApiClient } from '@/api/client'
import type { Machine } from '@/types/api'
import { usePlatform } from '@/hooks/usePlatform'
import { useMachinePathsExists } from '@/hooks/useMachinePathsExists'
import { useSpawnSession } from '@/hooks/mutations/useSpawnSession'
import { useSessions } from '@/hooks/queries/useSessions'
import { useProfiles } from '@/hooks/queries/useProfiles'
import { useActiveSuggestions, type Suggestion } from '@/hooks/useActiveSuggestions'
import { useDirectorySuggestions } from '@/hooks/useDirectorySuggestions'
import { useRecentPaths } from '@/hooks/useRecentPaths'
import { useTranslation } from '@/lib/use-translation'
import { makeClientSideId } from '@/lib/messages'
import type { AgentType, ClaudeEffort, CodexReasoningEffort, SessionType } from './types'
import { ActionButtons } from './ActionButtons'
import { AdditionalParametersSection } from './AdditionalParametersSection'
import { AgentSelector } from './AgentSelector'
import { DirectorySection } from './DirectorySection'
import { MachineSelector } from './MachineSelector'
import { ModelSelector } from './ModelSelector'
import { ProfileSection } from './ProfileSection'
import { ClaudeEffortSelector } from './ClaudeEffortSelector'
import { ReasoningEffortSelector } from './ReasoningEffortSelector'
import {
    loadLegacySessionProfiles,
    clearLegacyStorage,
    hasLegacyData,
    type SessionProfile,
    type SessionProfileConfig,
} from './preferences'
import { SessionTypeSelector } from './SessionTypeSelector'
import { YoloToggle } from './YoloToggle'
import { formatRunnerSpawnError } from '../../utils/formatRunnerSpawnError'

export function NewSession(props: {
    api: ApiClient
    machines: Machine[]
    isLoading?: boolean
    onSuccess: (sessionId: string) => void
    onCancel: () => void
}) {
    const { haptic } = usePlatform()
    const { t } = useTranslation()
    const { spawnSession, isPending, error: spawnError } = useSpawnSession(props.api)
    const { sessions } = useSessions(props.api)
    const { profiles, saveProfile, deleteProfile: deleteProfileApi } = useProfiles(props.api)
    const isFormDisabled = Boolean(isPending || props.isLoading)
    const { getRecentPaths, addRecentPath, getLastUsedMachineId, setLastUsedMachineId } = useRecentPaths()

    const [machineId, setMachineId] = useState<string | null>(null)
    const [directory, setDirectory] = useState('')
    const [suppressSuggestions, setSuppressSuggestions] = useState(false)
    const [isDirectoryFocused, setIsDirectoryFocused] = useState(false)
    const [agent, setAgent] = useState<AgentType>('claude')
    const [model, setModel] = useState('auto')
    const [effort, setEffort] = useState<ClaudeEffort>('auto')
    const [modelReasoningEffort, setModelReasoningEffort] = useState<CodexReasoningEffort>('default')
    const [yoloMode, setYoloMode] = useState(false)
    const [sessionType, setSessionType] = useState<SessionType>('simple')
    const [worktreeName, setWorktreeName] = useState('')
    const [additionalParameters, setAdditionalParameters] = useState<string[]>([])
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
    const [profileName, setProfileName] = useState('')
    const [directoryCreationConfirmed, setDirectoryCreationConfirmed] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const worktreeInputRef = useRef<HTMLInputElement>(null)
    const skipAgentDefaultsRef = useRef(false)
    const migrationDoneRef = useRef(false)

    // One-time migration from localStorage to file-based profiles
    useEffect(() => {
        if (migrationDoneRef.current) return
        if (!hasLegacyData()) {
            migrationDoneRef.current = true
            return
        }

        const legacyProfiles = loadLegacySessionProfiles()
        if (legacyProfiles.length === 0) {
            clearLegacyStorage()
            migrationDoneRef.current = true
            return
        }

        migrationDoneRef.current = true
        // Save each legacy profile to the server, then clear localStorage
        Promise.all(legacyProfiles.map((profile) => saveProfile(profile).catch(() => {
            // Ignore individual save errors during migration
        }))).then(() => {
            clearLegacyStorage()
        }).catch(() => {
            // If migration fails entirely, leave localStorage intact for next attempt
            migrationDoneRef.current = false
        })
    }, [saveProfile])

    const selectedProfile = useMemo(
        () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
        [profiles, selectedProfileId]
    )

    const currentProfileConfig = useCallback((): SessionProfileConfig => ({
        agent,
        model,
        effort,
        modelReasoningEffort,
        yoloMode,
        sessionType,
        worktreeName,
        additionalParameters: [...additionalParameters],
        permissionMode: 'default',
        collaborationMode: 'default',
    }), [additionalParameters, agent, effort, model, modelReasoningEffort, sessionType, worktreeName, yoloMode])

    const applyProfile = useCallback((profile: SessionProfile | null) => {
        if (!profile) {
            return
        }
        skipAgentDefaultsRef.current = true
        setAgent(profile.config.agent)
        setModel(profile.config.model)
        setEffort(profile.config.effort)
        setModelReasoningEffort(profile.config.modelReasoningEffort)
        setYoloMode(profile.config.yoloMode)
        setSessionType(profile.config.sessionType)
        setWorktreeName(profile.config.worktreeName)
        setAdditionalParameters([...profile.config.additionalParameters])
        setProfileName(profile.name)
    }, [])

    useEffect(() => {
        if (sessionType === 'worktree') {
            worktreeInputRef.current?.focus()
        }
    }, [sessionType])

    useEffect(() => {
        if (skipAgentDefaultsRef.current) {
            skipAgentDefaultsRef.current = false
            return
        }
        setModel('auto')
        setEffort('auto')
    }, [agent])

    useEffect(() => {
        if (!selectedProfileId) {
            return
        }
        if (!selectedProfile) {
            setSelectedProfileId(null)
            return
        }
        applyProfile(selectedProfile)
    }, [applyProfile, selectedProfile, selectedProfileId])

    useEffect(() => {
        if (props.machines.length === 0) return
        if (machineId && props.machines.find((m) => m.id === machineId)) return

        const lastUsed = getLastUsedMachineId()
        const foundLast = lastUsed ? props.machines.find((m) => m.id === lastUsed) : null

        if (foundLast) {
            setMachineId(foundLast.id)
            const paths = getRecentPaths(foundLast.id)
            if (paths[0]) setDirectory(paths[0])
        } else if (props.machines[0]) {
            setMachineId(props.machines[0].id)
        }
    }, [props.machines, machineId, getLastUsedMachineId, getRecentPaths])

    const selectedMachine = useMemo(
        () => (machineId ? props.machines.find((machine) => machine.id === machineId) ?? null : null),
        [machineId, props.machines]
    )
    const runnerSpawnError = useMemo(
        () => formatRunnerSpawnError(selectedMachine),
        [selectedMachine]
    )

    const recentPaths = useMemo(
        () => getRecentPaths(machineId),
        [getRecentPaths, machineId]
    )

    const trimmedDirectory = directory.trim()
    const deferredDirectory = useDeferredValue(trimmedDirectory)
    const allPaths = useDirectorySuggestions(machineId, sessions, recentPaths)

    const pathsToCheck = useMemo(
        () => Array.from(new Set([
            ...(deferredDirectory ? [deferredDirectory] : []),
            ...allPaths
        ])).slice(0, 1000),
        [allPaths, deferredDirectory]
    )

    const { pathExistence, checkPathsExists } = useMachinePathsExists(props.api, machineId, pathsToCheck)

    const verifiedPaths = useMemo(
        () => allPaths.filter((path) => pathExistence[path]),
        [allPaths, pathExistence]
    )

    const currentDirectoryExists = trimmedDirectory ? pathExistence[trimmedDirectory] : undefined
    const needsDirectoryCreationWarning = sessionType === 'simple' && trimmedDirectory !== '' && currentDirectoryExists === false
    const missingWorktreeDirectory = sessionType === 'worktree' && trimmedDirectory !== '' && currentDirectoryExists === false
    const directoryStatusMessage = missingWorktreeDirectory
        ? t('session.directoryMissingWorktree')
        : needsDirectoryCreationWarning
            ? (
                directoryCreationConfirmed
                    ? t('session.directoryMissingSimpleConfirm')
                    : t('session.directoryMissingSimple')
            )
            : null
    const directoryStatusTone = missingWorktreeDirectory ? 'error' : needsDirectoryCreationWarning ? 'warning' : null
    const createLabel = needsDirectoryCreationWarning && directoryCreationConfirmed
        ? t('session.createAndCreateDirectory')
        : undefined

    useEffect(() => {
        setDirectoryCreationConfirmed(false)
    }, [machineId, sessionType, trimmedDirectory])

    const getSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
        const lowered = query.toLowerCase()
        return verifiedPaths
            .filter((path) => path.toLowerCase().includes(lowered))
            .slice(0, 8)
            .map((path) => ({
                key: path,
                text: path,
                label: path
            }))
    }, [verifiedPaths])

    const activeQuery = (!isDirectoryFocused || suppressSuggestions) ? null : directory

    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeQuery,
        getSuggestions,
        { allowEmptyQuery: true, autoSelectFirst: false }
    )

    const handleMachineChange = useCallback((newMachineId: string) => {
        setMachineId(newMachineId)
        const paths = getRecentPaths(newMachineId)
        if (paths[0]) {
            setDirectory(paths[0])
        } else {
            setDirectory('')
        }
    }, [getRecentPaths])

    const handlePathClick = useCallback((path: string) => {
        setDirectory(path)
    }, [])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (suggestion) {
            setDirectory(suggestion.text)
            clearSuggestions()
            setSuppressSuggestions(true)
        }
    }, [suggestions, clearSuggestions])

    const handleDirectoryChange = useCallback((value: string) => {
        setSuppressSuggestions(false)
        setDirectory(value)
    }, [])

    const handleSelectProfile = useCallback((profileId: string | null) => {
        setSelectedProfileId(profileId)
        if (!profileId) {
            setProfileName('')
        }
    }, [])

    const handleSaveProfileAsNew = useCallback(() => {
        const trimmedName = profileName.trim()
        if (!trimmedName) {
            return
        }

        const now = Date.now()
        const profile: SessionProfile = {
            id: makeClientSideId('profile'),
            name: trimmedName,
            config: currentProfileConfig(),
            createdAt: now,
            updatedAt: now,
        }

        saveProfile(profile).then(() => {
            setSelectedProfileId(profile.id)
            setProfileName(trimmedName)
        }).catch(() => {
            // Save error handled by mutation state
        })
    }, [currentProfileConfig, profileName, saveProfile])

    const handleUpdateProfile = useCallback(() => {
        if (!selectedProfile) {
            return
        }

        const trimmedName = profileName.trim()
        if (!trimmedName) {
            return
        }

        const updatedProfile: SessionProfile = {
            ...selectedProfile,
            name: trimmedName,
            config: currentProfileConfig(),
            updatedAt: Date.now(),
        }

        saveProfile(updatedProfile).catch(() => {
            // Save error handled by mutation state
        })
    }, [currentProfileConfig, profileName, selectedProfile, saveProfile])

    const handleDeleteProfile = useCallback(() => {
        if (!selectedProfile) {
            return
        }

        const confirmed = window.confirm(t('newSession.profile.confirmDelete', { name: selectedProfile.name }))
        if (!confirmed) {
            return
        }

        deleteProfileApi(selectedProfile.id).then(() => {
            setSelectedProfileId(null)
        }).catch(() => {
            // Delete error handled by mutation state
        })
    }, [selectedProfile, t, deleteProfileApi])

    const handleDirectoryFocus = useCallback(() => {
        setSuppressSuggestions(false)
        setIsDirectoryFocused(true)
    }, [])

    const handleDirectoryBlur = useCallback(() => {
        setIsDirectoryFocused(false)
    }, [])

    const handleDirectoryKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveUp()
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveDown()
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            if (selectedIndex >= 0) {
                event.preventDefault()
                handleSuggestionSelect(selectedIndex)
            }
        }

        if (event.key === 'Escape') {
            clearSuggestions()
        }
    }, [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions, handleSuggestionSelect])

    async function handleCreate() {
        if (!machineId || !trimmedDirectory) return

        setError(null)
        try {
            const existsResult = await checkPathsExists([trimmedDirectory])
            const directoryExists = existsResult[trimmedDirectory]

            if (sessionType === 'worktree' && directoryExists === false) {
                haptic.notification('error')
                setError(t('session.directoryMissingWorktree'))
                return
            }

            if (sessionType === 'simple' && directoryExists === false && !directoryCreationConfirmed) {
                setDirectoryCreationConfirmed(true)
                return
            }

            const resolvedModel = model !== 'auto' && agent !== 'opencode' ? model : undefined
            const resolvedEffort = agent === 'claude' && effort !== 'auto' ? effort : undefined
            const resolvedModelReasoningEffort = agent === 'codex' && modelReasoningEffort !== 'default'
                ? modelReasoningEffort
                : undefined
            const resolvedAdditionalParameters = agent === 'claude'
                ? additionalParameters.map((parameter) => parameter.trim()).filter(Boolean)
                : undefined
            const result = await spawnSession({
                machineId,
                directory: trimmedDirectory,
                agent,
                model: resolvedModel,
                effort: resolvedEffort,
                modelReasoningEffort: resolvedModelReasoningEffort,
                yolo: yoloMode,
                sessionType,
                worktreeName: sessionType === 'worktree' ? (worktreeName.trim() || undefined) : undefined,
                additionalParameters: resolvedAdditionalParameters
            })

            if (result.type === 'success') {
                haptic.notification('success')
                setLastUsedMachineId(machineId)
                addRecentPath(machineId, trimmedDirectory)
                props.onSuccess(result.sessionId)
                return
            }

            haptic.notification('error')
            setError(result.message)
        } catch (e) {
            haptic.notification('error')
            setError(e instanceof Error ? e.message : 'Failed to create session')
        }
    }

    const canCreate = Boolean(machineId && trimmedDirectory && !isFormDisabled && !missingWorktreeDirectory)

    return (
        <div className="flex flex-col divide-y divide-[var(--app-divider)]">
            <ProfileSection
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                profileName={profileName}
                isDisabled={isFormDisabled}
                onProfileNameChange={setProfileName}
                onSelectProfile={handleSelectProfile}
                onSaveAsNew={handleSaveProfileAsNew}
                onUpdateProfile={handleUpdateProfile}
                onDeleteProfile={handleDeleteProfile}
            />
            <MachineSelector
                machines={props.machines}
                machineId={machineId}
                isLoading={props.isLoading}
                isDisabled={isFormDisabled}
                onChange={handleMachineChange}
            />
            {runnerSpawnError ? (
                <div className="px-3 py-2 text-xs text-red-600">
                    Runner last spawn error: {runnerSpawnError}
                </div>
            ) : null}
            <DirectorySection
                directory={directory}
                suggestions={suggestions}
                selectedIndex={selectedIndex}
                isDisabled={isFormDisabled}
                recentPaths={recentPaths}
                statusMessage={directoryStatusMessage}
                statusTone={directoryStatusTone}
                onDirectoryChange={handleDirectoryChange}
                onDirectoryFocus={handleDirectoryFocus}
                onDirectoryBlur={handleDirectoryBlur}
                onDirectoryKeyDown={handleDirectoryKeyDown}
                onSuggestionSelect={handleSuggestionSelect}
                onPathClick={handlePathClick}
            />
            <SessionTypeSelector
                sessionType={sessionType}
                worktreeName={worktreeName}
                worktreeInputRef={worktreeInputRef}
                isDisabled={isFormDisabled}
                onSessionTypeChange={setSessionType}
                onWorktreeNameChange={setWorktreeName}
            />
            <AgentSelector
                agent={agent}
                isDisabled={isFormDisabled}
                onAgentChange={setAgent}
            />
            <ModelSelector
                agent={agent}
                model={model}
                isDisabled={isFormDisabled}
                onModelChange={setModel}
            />
            <ClaudeEffortSelector
                agent={agent}
                effort={effort}
                isDisabled={isFormDisabled}
                onEffortChange={setEffort}
            />
            <ReasoningEffortSelector
                agent={agent}
                value={modelReasoningEffort}
                isDisabled={isFormDisabled}
                onChange={setModelReasoningEffort}
            />
            <YoloToggle
                yoloMode={yoloMode}
                isDisabled={isFormDisabled}
                onToggle={setYoloMode}
            />
            <AdditionalParametersSection
                agent={agent}
                parameters={additionalParameters}
                isDisabled={isFormDisabled}
                onChange={setAdditionalParameters}
            />

            {(error ?? spawnError) ? (
                <div className="px-3 py-2 text-sm text-red-600">
                    {error ?? spawnError}
                </div>
            ) : null}

            <ActionButtons
                isPending={isPending}
                canCreate={canCreate}
                isDisabled={isFormDisabled}
                createLabel={createLabel}
                onCancel={props.onCancel}
                onCreate={handleCreate}
            />
        </div>
    )
}
