import { describe, expect, it } from 'vitest'
import { ALPHABET, MODELS, REFLECTORS, ROTORS } from '../../../src/engine/index.ts'

const sorted = (s: string) => [...s].sort().join('')

describe('rotor data', () => {
  it.each(Object.values(ROTORS))('rotor $id is a permutation of A–Z', (rotor) => {
    expect(sorted(rotor.wiring)).toBe(ALPHABET)
  })

  it.each(Object.values(ROTORS))('rotor $id has valid notches', (rotor) => {
    expect(rotor.notches).toMatch(rotor.thin ? /^$/ : /^[A-Z]{1,2}$/)
  })

  it('has a distinct wiring for every rotor', () => {
    const wirings = Object.values(ROTORS).map((r) => r.wiring)
    expect(new Set(wirings).size).toBe(wirings.length)
  })
})

describe('reflector data', () => {
  it.each(Object.values(REFLECTORS))('$name is an involution with no fixed points', (ukw) => {
    expect(sorted(ukw.wiring)).toBe(ALPHABET)
    for (let i = 0; i < 26; i++) {
      const out = ALPHABET.indexOf(ukw.wiring[i])
      expect(out).not.toBe(i)
      expect(ALPHABET[ukw.wiring.indexOf(ALPHABET[i])]).toBe(ukw.wiring[i])
      expect(ukw.wiring[out]).toBe(ALPHABET[i])
    }
  })
})

describe('model data', () => {
  it('only references rotors and reflectors that exist, with matching thickness', () => {
    for (const model of Object.values(MODELS)) {
      for (const id of model.rotors) expect(ROTORS[id].thin).toBe(false)
      for (const id of model.thinRotors) expect(ROTORS[id].thin).toBe(true)
      for (const id of model.reflectors) expect(REFLECTORS[id].thin).toBe(model.slots === 4)
    }
  })
})
