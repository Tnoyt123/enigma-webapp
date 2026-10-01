import type { ReflectorId } from './reflectors.ts'
import type { RotorId } from './rotors.ts'

export type ModelId = 'I' | 'M3' | 'M4'

export interface ModelSpec {
  readonly id: ModelId
  readonly name: string
  readonly description: string
  /** Number of rotor slots, including the thin slot on the M4. */
  readonly slots: 3 | 4
  /** Rotors allowed in the stepping slots (the three rightmost). */
  readonly rotors: readonly RotorId[]
  /** Rotors allowed in the M4's non-stepping leftmost slot. */
  readonly thinRotors: readonly RotorId[]
  readonly reflectors: readonly ReflectorId[]
}

const STANDARD: readonly RotorId[] = ['I', 'II', 'III', 'IV', 'V']
const NAVAL: readonly RotorId[] = [...STANDARD, 'VI', 'VII', 'VIII']

export const MODELS: Readonly<Record<ModelId, ModelSpec>> = {
  I: {
    id: 'I',
    name: 'Enigma I',
    description: 'Army and Luftwaffe machine: three rotors from I–V and a plugboard.',
    slots: 3,
    rotors: STANDARD,
    thinRotors: [],
    reflectors: ['A', 'B', 'C'],
  },
  M3: {
    id: 'M3',
    name: 'Enigma M3',
    description: 'Kriegsmarine machine: three rotors chosen from I–VIII.',
    slots: 3,
    rotors: NAVAL,
    thinRotors: [],
    reflectors: ['B', 'C'],
  },
  M4: {
    id: 'M4',
    name: 'Enigma M4',
    description: 'U-boat machine (1942): a thin fourth rotor and thin reflector.',
    slots: 4,
    rotors: NAVAL,
    thinRotors: ['Beta', 'Gamma'],
    reflectors: ['B-thin', 'C-thin'],
  },
}
