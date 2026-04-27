function copyWithExecCommand(text: string): boolean {
    if (typeof document === 'undefined' || !document.body) {
        return false
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.padding = '0'
    textarea.style.border = '0'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = activeElement?.closest<HTMLElement>('[role="dialog"]') ?? document.body
    const selection = document.getSelection()
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

    root.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    let handledCopyEvent = false
    const onCopy = (event: ClipboardEvent) => {
        event.clipboardData?.setData('text/plain', text)
        event.preventDefault()
        handledCopyEvent = true
    }

    let copied = false
    try {
        document.addEventListener('copy', onCopy, true)
        copied = document.execCommand('copy') || handledCopyEvent
    } catch {
        copied = false
    } finally {
        document.removeEventListener('copy', onCopy, true)
        root.removeChild(textarea)
        if (selection) {
            selection.removeAllRanges()
            if (previousRange) {
                selection.addRange(previousRange)
            }
        }
        activeElement?.focus()
    }

    return copied
}

function shouldPreferExecCommand(): boolean {
    if (typeof document === 'undefined') return false
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return Boolean(activeElement?.closest('[role="dialog"]'))
}

export async function safeCopyToClipboard(text: string): Promise<void> {
    const preferExecCommand = shouldPreferExecCommand()
    if (preferExecCommand && copyWithExecCommand(text)) {
        return
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch {
            // Fall through to legacy copy strategy.
        }
    }

    if (!preferExecCommand && copyWithExecCommand(text)) {
        return
    }

    throw new Error('Copy to clipboard failed')
}
