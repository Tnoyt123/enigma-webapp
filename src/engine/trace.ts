import type { ReflectorId } from './data/reflectors.ts'
import type { RotorId } from './data/rotors.ts'

/**
 * Letters on the signal path are named by the fixed contact they sit on in the
 * machine frame (the contact that lines up with that letter at the entry wheel),
 * so consecutive stages always chain: one stage's `output` is the next one's `input`.
 */
export type Stage =
  | {
      readonly component: 'plugboard'
      readonly direction: 'forward' | 'backward'
      readonly input: string
      readonly output: string
      /** True if a cable is plugged into this letter's socket. */
      readonly swapped: boolean
    }
  | {
      readonly component: 'entry'
      readonly direction: 'forward' | 'backward'
      readonly input: string
      readonly output: string
    }
  | {
      readonly component: 'rotor'
      readonly direction: 'forward' | 'backward'
      /** Slot index, 0 = leftmost. */
      readonly slot: number
      readonly rotor: RotorId
      readonly input: string
      readonly output: string
      /** Contacts on the rotor's own core (letters of its wiring table) the signal uses. */
      readonly coreInput: string
      readonly coreOutput: string
      /** Window letter and ring setting at the moment the signal passed. */
      readonly position: string
      readonly ring: string
    }
  | {
      readonly component: 'reflector'
      readonly reflector: ReflectorId
      readonly input: string
      readonly output: string
    }

/** Everything that happened during one key press, for the lampboard, animations and explanations. */
export interface Trace {
  readonly input: string
  readonly output: string
  /** Window letters, left to right, before and after the rotors stepped. */
  readonly positionsBefore: string
  readonly positionsAfter: string
  /** Which slots advanced on this press (left to right). */
  readonly stepped: readonly boolean[]
  /** The middle rotor stepped because of its own notch: the double-stepping anomaly. */
  readonly doubleStep: boolean
  /** Signal path from keyboard to lamp, in order. */
  readonly stages: readonly Stage[]
}
