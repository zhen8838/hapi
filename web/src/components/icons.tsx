import type { ReactNode } from 'react'

type IconProps = {
    className?: string
}

function createIcon(paths: ReactNode, props: IconProps, strokeWidth = 1.5) {
    return (
        <svg
            className={props.className ?? 'h-4 w-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths}
        </svg>
    )
}

export function CloseIcon(props: IconProps) {
    return createIcon(
        <path d="M6 18 18 6M6 6l12 12" />,
        props,
        2
    )
}

export function ShareIcon(props: IconProps) {
    return createIcon(
        <path d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v12" />,
        props
    )
}

export function PlusCircleIcon(props: IconProps) {
    return createIcon(
        <path d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
        props
    )
}

export function CopyIcon(props: IconProps) {
    return createIcon(
        <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>,
        props,
        2
    )
}

export function CheckIcon(props: IconProps) {
    return createIcon(
        <polyline points="20 6 9 17 4 12" />,
        props,
        2
    )
}

// Path data adapted from lucide.dev `git-branch` glyph.
export function GitBranchIcon(props: IconProps) {
    return createIcon(
        <>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
        </>,
        props,
        2
    )
}

// Path data adapted from lucide.dev `folder-git-2` glyph.
export function FolderGit2Icon(props: IconProps) {
    return createIcon(
        <>
            <path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2" />
            <circle cx="13" cy="15" r="2" />
            <path d="M20 8v11a2 2 0 0 1-2 2h-3" />
            <path d="M13 17v5" />
            <path d="M13 13V8" />
        </>,
        props,
        2
    )
}
