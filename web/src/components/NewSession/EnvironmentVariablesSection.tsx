import { useTranslation } from '@/lib/use-translation'

export function EnvironmentVariablesSection(props: {
    value: string
    isDisabled: boolean
    onChange: (value: string) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="px-3 py-3">
            <div className="text-sm font-medium">{t('newSession.environmentVariables')}</div>
            <div className="mt-1 text-xs text-[var(--app-hint)]">
                {t('newSession.environmentVariables.help')}
            </div>
            <textarea
                value={props.value}
                disabled={props.isDisabled}
                placeholder="DEBUG=1"
                onChange={(event) => props.onChange(event.target.value)}
                className="mt-3 min-h-24 w-full resize-y rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-60"
            />
        </div>
    )
}
