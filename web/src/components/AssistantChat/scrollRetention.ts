export type ScrollMetrics = {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
}

export function getDistanceFromBottom(metrics: ScrollMetrics): number {
    return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
}

export function computeRetainedScrollTop(args: {
    previous: ScrollMetrics
    next: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>
    keepBottomAligned: boolean
}): number {
    const { previous, next, keepBottomAligned } = args

    if (keepBottomAligned) {
        const previousDistanceFromBottom = Math.max(0, getDistanceFromBottom(previous))
        return Math.max(0, next.scrollHeight - next.clientHeight - previousDistanceFromBottom)
    }

    const maxScrollTop = Math.max(0, next.scrollHeight - next.clientHeight)
    return Math.min(Math.max(0, previous.scrollTop), maxScrollTop)
}
