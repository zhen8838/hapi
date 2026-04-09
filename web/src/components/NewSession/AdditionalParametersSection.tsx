import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'

export function AdditionalParametersSection(props: {
    agent: 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
    parameters: string[]
    isDisabled: boolean
    onChange: (parameters: string[]) => void
}) {
    const { t } = useTranslation()

    const updateParameter = (index: number, value: string) => {
        props.onChange(props.parameters.map((parameter, currentIndex) => (
            currentIndex === index ? value : parameter
        )))
    }

    const removeParameter = (index: number) => {
        props.onChange(props.parameters.filter((_, currentIndex) => currentIndex !== index))
    }

    const addParameter = () => {
        props.onChange([...props.parameters, ''])
    }

    return (
        <div className="px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">{t('newSession.additionalParameters')}</div>
                    <div className="text-xs text-[var(--app-hint)]">
                        {t('newSession.additionalParameters.help')}
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.isDisabled}
                    onClick={addParameter}
                >
                    {t('newSession.additionalParameters.add')}
                </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
                {props.parameters.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-hint)]">
                        {t('newSession.additionalParameters.empty')}
                    </div>
                ) : null}

                {props.parameters.map((parameter, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={parameter}
                            disabled={props.isDisabled}
                            placeholder={index % 2 === 0 ? '--plugin-dir' : '/path/to/plugin'}
                            onChange={(event) => updateParameter(index, event.target.value)}
                            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-60"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={props.isDisabled}
                            onClick={() => removeParameter(index)}
                        >
                            {t('newSession.additionalParameters.remove')}
                        </Button>
                    </div>
                ))}
            </div>

            {props.agent !== 'claude' ? (
                <div className="mt-3 text-xs text-[var(--app-hint)]">
                    {t('newSession.additionalParameters.claudeOnly')}
                </div>
            ) : null}
        </div>
    )
}
