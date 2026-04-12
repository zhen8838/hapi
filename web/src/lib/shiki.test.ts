import { describe, expect, it } from 'vitest'
import { langAlias } from './shiki'

describe('shiki C++ support', () => {
    it('has c++ alias pointing to cpp', () => {
        expect(langAlias['c++']).toBe('cpp')
    })

    it('has cxx alias pointing to cpp', () => {
        expect(langAlias['cxx']).toBe('cpp')
    })

    it('has cc alias pointing to cpp', () => {
        expect(langAlias['cc']).toBe('cpp')
    })
})
