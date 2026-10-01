/**
 * Reflector (Umkehrwalze, UKW) wirings. Same sources as rotors.ts.
 * Every reflector is an involution with no fixed points, which is why Enigma is
 * self-reciprocal and why no letter can ever encrypt to itself.
 */

export type ReflectorId = 'A' | 'B' | 'C' | 'B-thin' | 'C-thin'

export interface ReflectorSpec {
  readonly id: ReflectorId
  readonly name: string
  readonly wiring: string
  /** Thin reflectors (M4) are paired with a thin rotor in the leftmost slot. */
  readonly thin: boolean
  readonly introduced: number
  readonly note: string
}

export const REFLECTORS: Readonly<Record<ReflectorId, ReflectorSpec>> = {
  A: {
    id: 'A',
    name: 'UKW-A',
    wiring: 'EJMZALYXVBWFCRQUONTSPIKHGD',
    thin: false,
    introduced: 1930,
    note: 'Original reflector, replaced by UKW-B in November 1937.',
  },
  B: {
    id: 'B',
    name: 'UKW-B',
    wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
    thin: false,
    introduced: 1937,
    note: 'The standard reflector for most of the war.',
  },
  C: {
    id: 'C',
    name: 'UKW-C',
    wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
    thin: false,
    introduced: 1940,
    note: 'Used only briefly, in 1940–41.',
  },
  'B-thin': {
    id: 'B-thin',
    name: 'UKW-B (thin)',
    wiring: 'ENKQAUYWJICOPBLMDXZVFTHRGS',
    thin: true,
    introduced: 1942,
    note: 'M4 reflector. With Beta at A (ring A) it behaves exactly like UKW-B.',
  },
  'C-thin': {
    id: 'C-thin',
    name: 'UKW-C (thin)',
    wiring: 'RDOBJNTKVEHMLFCWZAXGYIPSUQ',
    thin: true,
    introduced: 1943,
    note: 'M4 reflector. With Gamma at A (ring A) it behaves exactly like UKW-C.',
  },
}
