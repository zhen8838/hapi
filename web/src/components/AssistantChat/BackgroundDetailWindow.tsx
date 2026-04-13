export function BackgroundDetailWindow({ count }: { count: number }) {
    if (count <= 0) return null

    return (
        <div className="border-t border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--app-fg)]">
                <span className="text-blue-400">●</span>
                <span>{count} background task{count > 1 ? 's' : ''} running</span>
            </div>
        </div>
    )
}
