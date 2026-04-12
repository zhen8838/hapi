import { describe, expect, it } from 'vitest'
import { MARKDOWN_REHYPE_PLUGINS } from './markdown-text'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'

describe('MARKDOWN_REHYPE_PLUGINS', () => {
    it('includes rehype-raw', () => {
        expect(MARKDOWN_REHYPE_PLUGINS).toContain(rehypeRaw)
    })

    it('includes rehype-katex', () => {
        expect(MARKDOWN_REHYPE_PLUGINS).toContain(rehypeKatex)
    })

    it('has rehype-raw before rehype-katex (raw HTML must be parsed before KaTeX)', () => {
        const rawIndex = MARKDOWN_REHYPE_PLUGINS.indexOf(rehypeRaw)
        const katexIndex = MARKDOWN_REHYPE_PLUGINS.indexOf(rehypeKatex)
        expect(rawIndex).toBeLessThan(katexIndex)
    })
})
