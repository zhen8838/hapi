import { Button } from '@/components/ui/button'
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import { useRef } from 'react'
import { useTranslation } from '@/lib/use-translation'
import type { SessionProfile } from './preferences'

export function ProfileSection(props: {
    profiles: SessionProfile[]
    selectedProfileId: string | null
    profileName: string
    isDisabled: boolean
    onProfileNameChange: (name: string) => void
    onSelectProfile: (profileId: string | null) => void
    onSaveAsNew: () => void
    onUpdateProfile: () => void
    onDeleteProfile: () => void
}) {
    const { t } = useTranslation()
    const touchHandledRef = useRef<string | null>(null)

    const runAction = (
        key: string,
        action: () => void,
        disabled: boolean
    ) => {
        if (disabled) {
            return
        }
        touchHandledRef.current = key
        action()
    }

    const handleTouchStart = (
        event: ReactTouchEvent<HTMLButtonElement>,
        key: string,
        action: () => void,
        disabled: boolean
    ) => {
        if (disabled) {
            return
        }
        event.preventDefault()
        runAction(key, action, disabled)
    }

    const handleClick = (
        event: ReactMouseEvent<HTMLButtonElement>,
        key: string,
        action: () => void,
        disabled: boolean
    ) => {
        if (disabled) {
            return
        }
        if (touchHandledRef.current === key) {
            touchHandledRef.current = null
            event.preventDefault()
            return
        }
        action()
    }

    return (
        <div className="flex flex-col gap-2 px-3 py-3">
            <label className="text-xs font-medium text-[var(--app-hint)]">
                {t('newSession.profile')}
            </label>
            <select
                value={props.selectedProfileId ?? ''}
                onChange={(event) => props.onSelectProfile(event.target.value || null)}
                disabled={props.isDisabled}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
            >
                <option value="">{t('newSession.profile.none')}</option>
                {props.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                        {profile.name}
                    </option>
                ))}
            </select>
            <div className="text-xs text-[var(--app-hint)]">
                {t('newSession.profile.help')}
            </div>
            <input
                type="text"
                value={props.profileName}
                onChange={(event) => props.onProfileNameChange(event.target.value)}
                disabled={props.isDisabled}
                placeholder={t('newSession.profile.promptName')}
                className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-60"
            />
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.isDisabled || !props.profileName.trim()}
                    onTouchStart={(event) => handleTouchStart(event, 'save', props.onSaveAsNew, props.isDisabled || !props.profileName.trim())}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => handleClick(event, 'save', props.onSaveAsNew, props.isDisabled || !props.profileName.trim())}
                >
                    {t('newSession.profile.saveAsNew')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.isDisabled || !props.selectedProfileId || !props.profileName.trim()}
                    onTouchStart={(event) => handleTouchStart(event, 'update', props.onUpdateProfile, props.isDisabled || !props.selectedProfileId || !props.profileName.trim())}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => handleClick(event, 'update', props.onUpdateProfile, props.isDisabled || !props.selectedProfileId || !props.profileName.trim())}
                >
                    {t('newSession.profile.update')}
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={props.isDisabled || !props.selectedProfileId}
                    onTouchStart={(event) => handleTouchStart(event, 'delete', props.onDeleteProfile, props.isDisabled || !props.selectedProfileId)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => handleClick(event, 'delete', props.onDeleteProfile, props.isDisabled || !props.selectedProfileId)}
                >
                    {t('newSession.profile.delete')}
                </Button>
            </div>
        </div>
    )
}
