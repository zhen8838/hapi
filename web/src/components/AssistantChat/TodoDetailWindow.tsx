import type { TodoProgress } from './ComposerIndicators'

export function TodoDetailWindow({ progress }: { progress: TodoProgress }) {
    if (!progress || progress.total === 0) return null

    return (
        <div className="border-t border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-2 text-xs">
            <div className="flex flex-col gap-0.5">
                {progress.items.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center gap-2">
                        <span className={
                            item.status === 'completed' ? 'text-emerald-500' :
                            item.status === 'in_progress' ? 'text-blue-400' :
                            'text-[var(--app-hint)]'
                        }>
                            {item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '●' : '○'}
                        </span>
                        <span className={
                            item.status === 'completed'
                                ? 'text-[var(--app-hint)] line-through'
                                : item.status === 'in_progress'
                                    ? 'text-[var(--app-fg)]'
                                    : 'text-[var(--app-hint)]'
                        }>
                            {item.content}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
