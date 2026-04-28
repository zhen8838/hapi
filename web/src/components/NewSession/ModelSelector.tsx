import type { AgentType } from './types'
import { MODEL_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'
import type { ModelOption } from '@hapi/protocol'

const CUSTOM_MODEL_VALUE = '__custom__'

export function ModelSelector(props: {
    agent: AgentType
    model: string
    options?: ModelOption[]
    isDisabled: boolean
    onModelChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const options = props.options ?? MODEL_OPTIONS[props.agent]
    if (options.length === 0) {
        return null
    }
    const hasSelectedModel = props.model === 'auto' || options.some((option) => option.value === props.model)
    const selectValue = hasSelectedModel ? props.model : CUSTOM_MODEL_VALUE
    const showCustomInput = selectValue === CUSTOM_MODEL_VALUE

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium text-[var(--app-hint)]">
                {t('newSession.model')}{' '}
                <span className="font-normal">({t('newSession.model.optional')})</span>
            </label>
            <select
                value={selectValue}
                onChange={(e) => {
                    const nextValue = e.target.value
                    props.onModelChange(nextValue === CUSTOM_MODEL_VALUE ? '' : nextValue)
                }}
                disabled={props.isDisabled}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>{t('newSession.model.custom')}</option>
            </select>
            {showCustomInput ? (
                <input
                    value={props.model === 'auto' ? '' : props.model}
                    onChange={(e) => props.onModelChange(e.target.value)}
                    disabled={props.isDisabled}
                    placeholder="gpt-..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                />
            ) : null}
        </div>
    )
}
