/**
 * Rotor (Walze) wirings, as published in the standard references: Crypto Museum,
 * and Hamer, Sullivan & Weierud, "Enigma Variations", Cryptologia 22(3), 1998.
 *
 * `wiring[i]` is the contact that core contact `i` connects to on the left (outbound)
 * side, with ring setting A (01) at position A. `notches` are the window letters
 * at which this rotor makes its left neighbour step on the next key press.
 */

export type RotorId = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'Beta' | 'Gamma'

export interface RotorSpec {
  readonly id: RotorId
  readonly wiring: string
  readonly notches: string
  /** Thin "Zusatzwalze" of the M4: fits only the leftmost slot and never steps. */
  readonly thin: boolean
  /** Approximate year of introduction. */
  readonly introduced: number
  readonly note: string
}

export const ROTORS: Readonly<Record<RotorId, RotorSpec>> = {
  I: {
    id: 'I',
    wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ',
    notches: 'Q',
    thin: false,
    introduced: 1930,
    note: 'One of the three original Enigma I rotors.',
  },
  II: {
    id: 'II',
    wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE',
    notches: 'E',
    thin: false,
    introduced: 1930,
    note: 'One of the three original Enigma I rotors.',
  },
  III: {
    id: 'III',
    wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO',
    notches: 'V',
    thin: false,
    introduced: 1930,
    note: 'One of the three original Enigma I rotors.',
  },
  IV: {
    id: 'IV',
    wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB',
    notches: 'J',
    thin: false,
    introduced: 1938,
    note: 'Added in December 1938, raising the choice to three of five rotors.',
  },
  V: {
    id: 'V',
    wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK',
    notches: 'Z',
    thin: false,
    introduced: 1938,
    note: 'Added in December 1938, raising the choice to three of five rotors.',
  },
  VI: {
    id: 'VI',
    wiring: 'JPGVOUMFYQBENHZRDKASXLICTW',
    notches: 'ZM',
    thin: false,
    introduced: 1939,
    note: 'Kriegsmarine only. Two notches, so it turns its neighbour twice per revolution.',
  },
  VII: {
    id: 'VII',
    wiring: 'NZJHGRCXMYSWBOUFAIVLPEKQDT',
    notches: 'ZM',
    thin: false,
    introduced: 1939,
    note: 'Kriegsmarine only. Two notches, so it turns its neighbour twice per revolution.',
  },
  VIII: {
    id: 'VIII',
    wiring: 'FKQHTLXOCBJSPDZRAMEWNIUYGV',
    notches: 'ZM',
    thin: false,
    introduced: 1940,
    note: 'Kriegsmarine only. Two notches, so it turns its neighbour twice per revolution.',
  },
  Beta: {
    id: 'Beta',
    wiring: 'LEYJVCNIXWPBQMDRTAKZGFUHOS',
    notches: '',
    thin: true,
    introduced: 1942,
    note: 'Thin fourth rotor of the M4, introduced with it in February 1942. Never steps.',
  },
  Gamma: {
    id: 'Gamma',
    wiring: 'FSOKANUERHMBTIYCWLQPZXVGJD',
    notches: '',
    thin: true,
    introduced: 1943,
    note: 'Second thin rotor for the M4, introduced July 1943. Never steps.',
  },
}
