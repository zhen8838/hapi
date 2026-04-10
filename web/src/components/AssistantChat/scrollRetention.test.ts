import { describe, expect, it } from 'vitest'
import { computeRetainedScrollTop, getDistanceFromBottom } from './scrollRetention'

describe('scrollRetention', () => {
    it('preserves exact scrollTop when not bottom aligned', () => {
        expect(computeRetainedScrollTop({
            previous: {
                scrollTop: 420,
                scrollHeight: 2000,
                clientHeight: 600,
            },
            next: {
                scrollHeight: 2000,
                clientHeight: 400,
            },
            keepBottomAligned: false,
        })).toBe(420)
    })

    it('keeps the same distance from bottom when bottom aligned', () => {
        const previous = {
            scrollTop: 1400,
            scrollHeight: 2000,
            clientHeight: 600,
        }

        expect(getDistanceFromBottom(previous)).toBe(0)

        expect(computeRetainedScrollTop({
            previous,
            next: {
                scrollHeight: 2000,
                clientHeight: 400,
            },
            keepBottomAligned: true,
        })).toBe(1600)
    })

    it('clamps scrollTop when next viewport is shorter than previous range', () => {
        expect(computeRetainedScrollTop({
            previous: {
                scrollTop: 900,
                scrollHeight: 1200,
                clientHeight: 400,
            },
            next: {
                scrollHeight: 500,
                clientHeight: 300,
            },
            keepBottomAligned: false,
        })).toBe(200)
    })
})
