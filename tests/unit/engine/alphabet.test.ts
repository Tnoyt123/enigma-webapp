import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ALPHABET, mod26, toIndex, toLetter } from '../../../src/engine/index.ts'

describe('alphabet helpers', () => {
  it('maps letters to indices and back', () => {
    expect(toIndex('A')).toBe(0)
    expect(toIndex('z')).toBe(25)
    expect(toLetter(0)).toBe('A')
    expect(toLetter(27)).toBe('B')
    expect(toLetter(-1)).toBe('Z')
  })

  it('rejects non-letters', () => {
    for (const bad of ['', 'AB', '1', 'Ä', ' ']) expect(() => toIndex(bad)).toThrow(RangeError)
  })

  it('mod26 is always in range', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const m = mod26(n)
        return m >= 0 && m < 26 && (m - n) % 26 === 0
      }),
    )
  })

  it('toLetter/toIndex round-trip for every letter', () => {
    for (const ch of ALPHABET) expect(toLetter(toIndex(ch))).toBe(ch)
  })
})
