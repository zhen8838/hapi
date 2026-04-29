import { useEffect, useState } from 'react'
import { BellIcon, CloseIcon } from '@/components/icons'
import { usePlatform } from '@/hooks/usePlatform'
import { useTranslation } from '@/lib/use-translation'

type NotificationPromptProps = {
    isSafari: boolean
    isSupported: boolean
    permission: NotificationPermission
    isSubscribed: boolean
    onEnable: () => Promise<boolean>
}

export function NotificationPrompt(props: NotificationPromptProps) {
    const { t } = useTranslation()
    const { haptic } = usePlatform()
    const [dismissed, setDismissed] = useState(false)
    const [enabling, setEnabling] = useState(false)
    const show = props.isSafari
        && props.isSupported
        && props.permission !== 'denied'
        && !props.isSubscribed
        && !dismissed

    useEffect(() => {
        const root = document.documentElement
        if (!root) return

        if (show) {
            root.style.setProperty('--app-floating-bottom-offset', '112px')
        } else {
            root.style.removeProperty('--app-floating-bottom-offset')
        }

        return () => {
            root.style.removeProperty('--app-floating-bottom-offset')
        }
    }, [show])

    if (!show) {
        return null
    }

    const handleEnable = async () => {
        haptic.impact('light')
        setEnabling(true)
        const success = await props.onEnable()
        setEnabling(false)

        if (success) {
            haptic.notification('success')
            setDismissed(true)
            return
        }

        haptic.notification('error')
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 bg-[var(--app-secondary-bg)] border border-[var(--app-border)] rounded-lg p-4 shadow-lg z-50">
            <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--app-fg)]">
                        {t('notification.title')}
                    </p>
                    <p className="text-xs text-[var(--app-hint)] mt-0.5">
                        {t('notification.description')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleEnable}
                    disabled={enabling}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-[var(--app-fg)] text-[var(--app-bg)] rounded-lg text-sm font-medium active:opacity-80 disabled:opacity-60"
                >
                    <BellIcon className="w-4 h-4" />
                    {enabling ? t('notification.enabling') : t('notification.button')}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        haptic.impact('light')
                        setDismissed(true)
                    }}
                    className="shrink-0 p-2 text-[var(--app-hint)] active:opacity-60"
                    aria-label={t('button.dismiss')}
                >
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
