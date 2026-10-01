import { describe, expect, it } from 'vitest'
import { toGroups } from '../../../src/engine/index.ts'
import { createMachineStore } from '../../../src/state/machineStore.ts'

const fresh = () => createMachineStore().getState
const typeKeys = (store: ReturnType<typeof createMachineStore>, text: string) => {
  for (const ch of text) {
    store.getState().keyDown(ch)
    store.getState().keyUp()
  }
}

describe('machine store', () => {
  it('starts as an Enigma I with I-II-III, UKW-B, everything at A', () => {
    const state = fresh()()
    expect(state.config).toMatchObject({ model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'] })
    expect(state.positions).toEqual([0, 0, 0])
  })

  it('types onto the tape and steps the rotors', () => {
    const store = createMachineStore()
    typeKeys(store, 'AAAAA')
    const { tape, positions } = store.getState()
    expect(tape).toEqual({ input: 'AAAAA', output: 'BDZGO', start: [0, 0, 0] })
    expect(positions).toEqual([0, 0, 5])
  })

  it('lights the lamp only while the key is held, and locks other keys meanwhile', () => {
    const store = createMachineStore()
    expect(store.getState().keyDown('A')?.output).toBe('B')
    expect(store.getState().litLamp).toBe('B')
    expect(store.getState().keyDown('C')).toBeNull()
    store.getState().keyUp()
    expect(store.getState()).toMatchObject({ litLamp: null, heldKey: null })
    expect(store.getState().tape.input).toBe('A')
  })

  it('enciphers bulk text, skipping non-letters, and resets to the tape start', () => {
    const store = createMachineStore()
    expect(store.getState().encipherText('aa aa-a!')).toBe('BDZGO')
    expect(toGroups(store.getState().tape.output)).toBe('BDZGO')
    store.getState().resetToTapeStart()
    expect(store.getState().positions).toEqual([0, 0, 0])
    expect(store.getState().tape.input).toBe('')
    expect(store.getState().encipherText('BDZGO')).toBe('AAAAA')
  })

  it('ignores bulk text with no letters', () => {
    const store = createMachineStore()
    expect(store.getState().encipherText('123 !')).toBe('')
    expect(store.getState().tape.start).toBeNull()
  })

  it('swaps rotors when one is chosen for a second slot', () => {
    const store = createMachineStore()
    expect(store.getState().setRotor(0, 'III')).toEqual([])
    expect(store.getState().config.rotors).toEqual(['III', 'II', 'I'])
    store.getState().setRotor(1, 'V')
    expect(store.getState().config.rotors).toEqual(['III', 'V', 'I'])
  })

  it('switches models, keeping compatible settings and filling in the M4 thin slot', () => {
    const store = createMachineStore()
    store.getState().setRotor(2, 'V')
    store.getState().setModel('M3')
    expect(store.getState().config).toMatchObject({ model: 'M3', rotors: ['I', 'II', 'V'] })
    store.getState().setRotor(2, 'VIII')
    store.getState().setModel('M4')
    expect(store.getState().config).toMatchObject({
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'I', 'II', 'III'],
    })
    expect(store.getState().positions).toEqual([0, 0, 0, 0])
    store.getState().setModel('I')
    expect(store.getState().config).toMatchObject({ reflector: 'B', rotors: ['I', 'II', 'III'] })
  })

  it('falls back to defaults when the old rotors are not allowed on the new model', () => {
    const store = createMachineStore()
    store.getState().setModel('M3')
    store.getState().setRotor(0, 'VI')
    store.getState().setReflector('C')
    store.getState().setModel('I')
    expect(store.getState().config).toMatchObject({ reflector: 'C', rotors: ['I', 'II', 'III'] })
    expect(store.getState().setModel('I')).toEqual([])
  })

  it('rejects invalid changes and leaves the configuration alone', () => {
    const store = createMachineStore()
    expect(store.getState().setPlugboard(['AB', 'BC'])).toEqual([
      'Plugboard socket B is used by two cables.',
    ])
    expect(store.getState().config.plugboard).toEqual([])
    expect(store.getState().setReflector('B-thin')).toHaveLength(1)
    expect(store.getState().setPosition(0, 26)).toHaveLength(1)
  })

  it('applies rings, positions and plugboard to the cipher', () => {
    const store = createMachineStore()
    store.getState().setRotor(0, 'II')
    store.getState().setRotor(1, 'IV')
    store.getState().setRotor(2, 'V')
    ;[1, 20, 11].forEach((ring, slot) => store.getState().setRing(slot, ring))
    ;[1, 11, 0].forEach((pos, slot) => store.getState().setPosition(slot, pos))
    store.getState().setPlugboard('AV BS CG DL FU HZ IN KM OW RX'.split(' '))
    expect(store.getState().encipherText('EDPUDNRGYS')).toBe('AUFKLXABTE')
  })
})

describe('toGroups', () => {
  it('splits letters into groups of five by default', () => {
    expect(toGroups('abcdefghijkl')).toBe('ABCDE FGHIJ KL')
    expect(toGroups('AB CD-EF', 4)).toBe('ABCD EF')
    expect(toGroups('')).toBe('')
  })
})

describe('plugboard cabling', () => {
  it('starts, completes, cancels and removes cables', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    expect(s().activateSocket('A')).toMatch(/plugged into A/)
    expect(s().plugSelection).toBe('A')
    expect(s().activateSocket('V')).toBe('Connected A and V.')
    expect(s().config.plugboard).toEqual(['AV'])
    expect(s().plugSelection).toBeNull()
    expect(s().activateSocket('B')).toMatch(/plugged into B/)
    expect(s().activateSocket('B')).toBe('Cancelled cable from B.')
    s().activateSocket('C')
    expect(s().cancelPlug()).toBe('Cancelled cable from C.')
    expect(s().cancelPlug()).toBeNull()
    expect(s().activateSocket('V')).toBe('Unplugged V from A.')
    expect(s().config.plugboard).toEqual([])
    expect(s().plugMessage).toBe('Unplugged V from A.')
  })

  it('with all 13 cables in, every socket is plugged, so activating one unplugs it', () => {
    const store = createMachineStore()
    store.getState().setPlugboard('AB CD EF GH IJ KL MN OP QR ST UV WX YZ'.split(' '))
    expect(store.getState().activateSocket('Q')).toBe('Unplugged Q from R.')
  })
})
