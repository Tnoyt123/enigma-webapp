import fc from 'fast-check'
import { describe, it } from 'vitest'
import {
  ALPHABET,
  EnigmaMachine,
  MODELS,
  type MachineConfig,
  type ModelId,
  type RotorId,
} from '../../../src/engine/index.ts'

const letterIndex = fc.integer({ min: 0, max: 25 })
const text = fc.string({ unit: fc.constantFrom(...ALPHABET), minLength: 1, maxLength: 200 })

/** Up to 13 disjoint plugboard pairs, from a shuffled alphabet. */
const plugboard = fc
  .tuple(
    fc.shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 }),
    fc.integer({ min: 0, max: 13 }),
  )
  .map(([letters, n]) => Array.from({ length: n }, (_, i) => letters[2 * i] + letters[2 * i + 1]))

const configFor = (modelId: ModelId) => {
  const model = MODELS[modelId]
  const stepping = fc.shuffledSubarray([...model.rotors], { minLength: 3, maxLength: 3 })
  const rotors: fc.Arbitrary<RotorId[]> =
    model.slots === 4
      ? fc.tuple(fc.constantFrom(...model.thinRotors), stepping).map(([t, s]) => [t, ...s])
      : stepping
  return fc.record({
    config: fc.record<MachineConfig>({
      model: fc.constant(modelId),
      reflector: fc.constantFrom(...model.reflectors),
      rotors,
      rings: fc.array(letterIndex, { minLength: model.slots, maxLength: model.slots }),
      plugboard,
    }),
    positions: fc.array(letterIndex, { minLength: model.slots, maxLength: model.slots }),
  })
}

const anyMachine = fc.oneof(configFor('I'), configFor('M3'), configFor('M4'))

describe('Enigma properties', () => {
  it('is self-reciprocal: enciphering the ciphertext at the same start restores the plaintext', () => {
    fc.assert(
      fc.property(anyMachine, text, ({ config, positions }, plain) => {
        const cipher = new EnigmaMachine(config, positions).encipher(plain)
        return new EnigmaMachine(config, positions).encipher(cipher) === plain
      }),
    )
  })

  it('never enciphers a letter to itself', () => {
    fc.assert(
      fc.property(anyMachine, text, ({ config, positions }, plain) => {
        const cipher = new EnigmaMachine(config, positions).encipher(plain)
        return [...plain].every((ch, i) => cipher[i] !== ch)
      }),
    )
  })

  it('M4 with Beta at A (ring A) and thin UKW-B equals the 3-rotor machine with UKW-B; likewise Gamma/C', () => {
    fc.assert(
      fc.property(configFor('M3'), text, fc.boolean(), ({ config, positions }, plain, useC) => {
        const m3: MachineConfig = { ...config, reflector: useC ? 'C' : 'B' }
        const m4: MachineConfig = {
          ...m3,
          model: 'M4',
          reflector: useC ? 'C-thin' : 'B-thin',
          rotors: [useC ? 'Gamma' : 'Beta', ...m3.rotors],
          rings: [0, ...m3.rings],
        }
        return (
          new EnigmaMachine(m3, positions).encipher(plain) ===
          new EnigmaMachine(m4, [0, ...positions]).encipher(plain)
        )
      }),
    )
  })

  it('swapping a plugboard pair at both ends is the only plugboard effect (trace agrees with map)', () => {
    fc.assert(
      fc.property(anyMachine, fc.constantFrom(...ALPHABET), ({ config, positions }, key) => {
        const trace = new EnigmaMachine(config, positions).press(key)
        const first = trace.stages[0]
        const last = trace.stages.at(-1)!
        const partner = (ch: string) =>
          config.plugboard.find((p) => p.includes(ch))?.replace(ch, '') ?? ch
        return first.output === partner(key) && last.output === partner(last.input)
      }),
    )
  })
})
