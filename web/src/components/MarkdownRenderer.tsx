import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { MARKDOWN_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from '@/components/assistant-ui/markdown-text'
import { CodeBlock } from '@/components/CodeBlock'
import { MermaidDiagram } from '@/components/MermaidDiagram'
import { PlantUMLDiagram } from '@/components/PlantUMLDiagram'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    components?: Components
}

function childrenToText(children: ReactNode): string {
    if (typeof children === 'string') return children
    if (typeof children === 'number') return String(children)
    if (Array.isArray(children)) return children.map(childrenToText).join('')
    return ''
}

function languageFromClassName(className: string | undefined): string | undefined {
    const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? '')
    return match?.[1]
}

function Pre(props: ComponentPropsWithoutRef<'pre'>) {
    return <>{props.children}</>
}

function Code(props: ComponentPropsWithoutRef<'code'>) {
    const code = childrenToText(props.children).replace(/\n$/, '')
    const language = languageFromClassName(props.className)
    const isBlock = language !== undefined || code.includes('\n')

    if (isBlock) {
        if (language === 'mermaid') {
            return <MermaidDiagram code={code} language={language} components={{ Pre, Code }} />
        }
        if (language === 'plantuml' || language === 'puml') {
            return <PlantUMLDiagram code={code} language={language} components={{ Pre, Code }} />
        }

        return <CodeBlock code={code} language={language} />
    }

    return (
        <code
            {...props}
            className={cn(
                'aui-md-code break-words rounded bg-[var(--app-inline-code-bg)] px-[0.3em] py-[0.1em] font-mono text-[0.9em]',
                props.className
            )}
        />
    )
}

const defaultComponents = {
    pre: Pre,
    code: Code,
    h1: (props: ComponentPropsWithoutRef<'h1'>) => <h1 {...props} className={cn('aui-md-h1 mt-3 text-base font-semibold', props.className)} />,
    h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 {...props} className={cn('aui-md-h2 mt-3 text-base font-semibold', props.className)} />,
    h3: (props: ComponentPropsWithoutRef<'h3'>) => <h3 {...props} className={cn('aui-md-h3 mt-2 text-base font-semibold', props.className)} />,
    h4: (props: ComponentPropsWithoutRef<'h4'>) => <h4 {...props} className={cn('aui-md-h4 mt-2 text-base font-semibold', props.className)} />,
    h5: (props: ComponentPropsWithoutRef<'h5'>) => <h5 {...props} className={cn('aui-md-h5 mt-2 text-base font-semibold', props.className)} />,
    h6: (props: ComponentPropsWithoutRef<'h6'>) => <h6 {...props} className={cn('aui-md-h6 mt-2 text-base font-semibold', props.className)} />,
    a: (props: ComponentPropsWithoutRef<'a'>) => (
        <a
            {...props}
            rel={props.target === '_blank' ? (props.rel ?? 'noreferrer') : props.rel}
            className={cn('aui-md-a text-[var(--app-link)] underline', props.className)}
        />
    ),
    p: (props: ComponentPropsWithoutRef<'p'>) => <p {...props} className={cn('aui-md-p leading-relaxed', props.className)} />,
    strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong {...props} className={cn('aui-md-strong font-semibold', props.className)} />,
    em: (props: ComponentPropsWithoutRef<'em'>) => <em {...props} className={cn('aui-md-em italic', props.className)} />,
    blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
        <blockquote
            {...props}
            className={cn('aui-md-blockquote border-l-4 border-[var(--app-hint)] pl-3 opacity-85', props.className)}
        />
    ),
    ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul {...props} className={cn('aui-md-ul list-disc pl-6', props.className)} />,
    ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol {...props} className={cn('aui-md-ol list-decimal pl-6', props.className)} />,
    li: (props: ComponentPropsWithoutRef<'li'>) => <li {...props} className={cn('aui-md-li', props.className)} />,
    hr: (props: ComponentPropsWithoutRef<'hr'>) => <hr {...props} className={cn('aui-md-hr border-[var(--app-divider)]', props.className)} />,
    table: ({ className, ...rest }: ComponentPropsWithoutRef<'table'>) => (
        <div className="aui-md-table-wrapper max-w-full overflow-x-auto">
            <table {...rest} className={cn('aui-md-table w-full border-collapse', className)} />
        </div>
    ),
    thead: (props: ComponentPropsWithoutRef<'thead'>) => <thead {...props} className={cn('aui-md-thead', props.className)} />,
    tbody: (props: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} className={cn('aui-md-tbody', props.className)} />,
    tr: (props: ComponentPropsWithoutRef<'tr'>) => <tr {...props} className={cn('aui-md-tr', props.className)} />,
    th: (props: ComponentPropsWithoutRef<'th'>) => (
        <th
            {...props}
            className={cn('aui-md-th border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-2 py-1 text-left font-semibold', props.className)}
        />
    ),
    td: (props: ComponentPropsWithoutRef<'td'>) => <td {...props} className={cn('aui-md-td border border-[var(--app-border)] px-2 py-1', props.className)} />,
    img: (props: ComponentPropsWithoutRef<'img'>) => <img {...props} className={cn('aui-md-img max-w-full rounded', props.className)} />,
} satisfies Components

function MarkdownContent(props: MarkdownRendererProps) {
    const mergedComponents = props.components
        ? { ...defaultComponents, ...props.components }
        : defaultComponents

    return (
        <div className={cn('aui-md min-w-0 max-w-full break-words text-base')}>
            <ReactMarkdown
                remarkPlugins={MARKDOWN_PLUGINS}
                rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
                components={mergedComponents}
            >
                {props.content}
            </ReactMarkdown>
        </div>
    )
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
    return <MarkdownContent {...props} />
}
