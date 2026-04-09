import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'
import type { SessionProfile } from './preferences'

export function ProfileSection(props: {
    profiles: SessionProfile[]
    selectedProfileId: string | null
    isDisabled: boolean
    onSelectProfile: (profileId: string | null) => void
    onSaveAsNew: () => void
    onUpdateProfile: () => void
    onDeleteProfile: () => void
}) {
    const { t } = useTranslation()

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
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.isDisabled}
                    onClick={props.onSaveAsNew}
                >
                    {t('newSession.profile.saveAsNew')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.isDisabled || !props.selectedProfileId}
                    onClick={props.onUpdateProfile}
                >
                    {t('newSession.profile.update')}
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={props.isDisabled || !props.selectedProfileId}
                    onClick={props.onDeleteProfile}
                >
                    {t('newSession.profile.delete')}
                </Button>
            </div>
        </div>
    )
}
