import { describe, expect, it } from 'vitest'
import { toGroups } from '../../../src/engine/index.ts'
import { boxRotors, createMachineStore } from '../../../src/state/machineStore.ts'

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

  it('rotors in the box remember their ring settings', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().setRing(1, 4)
    s().setRotor(1, 'V') // II (ring E) goes to the box, V comes out at ring A
    expect(s().config.rings).toEqual([0, 0, 0])
    expect(s().boxRings).toEqual({ II: 4 })
    s().setRing(1, 9)
    s().setRotor(2, 'II') // II comes back with ring E; III goes to the box at ring A
    expect(s().config.rotors).toEqual(['I', 'V', 'II'])
    expect(s().config.rings).toEqual([0, 9, 4])
    expect(s().boxRings).toEqual({ III: 0 })
    s().setRotor(2, 'II') // already there: nothing changes
    expect(s().config.rings).toEqual([0, 9, 4])
    s().setModel('M3')
    expect(s().boxRings).toEqual({}) // a new model starts with fresh rings
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

describe('rotor bay', () => {
  it('lists the rotors left in the box for each model', () => {
    const store = createMachineStore()
    expect(boxRotors(store.getState().config)).toEqual(['IV', 'V'])
    store.getState().setModel('M4')
    expect(boxRotors(store.getState().config)).toEqual(['Gamma', 'IV', 'V', 'VI', 'VII', 'VIII'])
  })

  it('swaps two rotors in the machine; rings go with the rotors, positions stay with the slots', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().setRing(0, 5)
    s().setPosition(0, 7)
    expect(s().liftRotor(0)).toBe('Lifted rotor I out of the left slot. Choose where to put it.')
    expect(s().hand).toEqual({ rotor: 'I', from: 0 })
    expect(s().placeRotor(2)).toBe(
      'Rotor I is in the right slot; rotor III moved to the left slot.',
    )
    expect(s().config.rotors).toEqual(['III', 'II', 'I'])
    expect(s().config.rings).toEqual([0, 0, 5]) // rotor I took its ring F with it
    expect(s().positions).toEqual([7, 0, 0])
    expect(s().hand).toBeNull()
  })

  it('replaces a rotor with one from the box', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().liftRotor('box', 'V')
    expect(s().placeRotor(1)).toBe('Rotor V is in the middle slot; rotor II went back to the box.')
    expect(s().config.rotors).toEqual(['I', 'V', 'III'])
    expect(boxRotors(s().config)).toEqual(['II', 'IV'])
  })

  it('placing with an empty hand lifts that slot’s rotor; placing back where it came from is a no-op', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().placeRotor(1)
    expect(s().hand).toEqual({ rotor: 'II', from: 1 })
    expect(s().placeRotor(1)).toBe('Put rotor II back in the middle slot.')
    expect(s().config.rotors).toEqual(['I', 'II', 'III'])
  })

  it('refuses rotors the slot cannot take and keeps holding them', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().setModel('M4')
    s().liftRotor('box', 'Gamma')
    expect(s().placeRotor(2)).toMatch(/Rotor "Gamma" can't be used in slot 3/)
    expect(s().hand).toEqual({ rotor: 'Gamma', from: 'box' })
    expect(s().placeRotor(0)).toBe(
      'Rotor Gamma is in the thin slot; rotor Beta went back to the box.',
    )
  })

  it('blocks the keys while a rotor is out, and returning or closing the lid puts it back', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().setLidOpen(true)
    s().liftRotor(0)
    expect(s().keyDown('A')).toBeNull()
    expect(s().rotorMessage).toMatch(/Put rotor I down before typing/)
    expect(s().tape.input).toBe('')
    expect(s().returnRotor()).toBe('Put rotor I back in the left slot.')
    expect(s().returnRotor()).toBeNull()
    // Opening the ring close-up puts the rotor in hand back; lifting one closes the close-up.
    s().liftRotor('box', 'IV')
    s().setRingSlot(2)
    expect(s()).toMatchObject({ hand: null, ringSlot: 2 })
    s().liftRotor('box', 'IV')
    expect(s()).toMatchObject({ hand: { rotor: 'IV', from: 'box' }, ringSlot: null })
    expect(s().setLidOpen(false)).toBe('Put rotor IV back and closed the lid.')
    expect(s()).toMatchObject({ lidOpen: false, hand: null, ringSlot: null })
    expect(s().keyDown('A')).not.toBeNull()
  })
})

describe('pulling a plug', () => {
  it('leaves the other end plugged in and ready to move', () => {
    const store = createMachineStore()
    const s = () => store.getState()
    s().setPlugboard(['AV'])
    expect(s().pullPlug('A')).toBe(
      'Pulled the plug out of A; the cable is still in V. Choose a socket for it.',
    )
    expect(s()).toMatchObject({ plugSelection: 'V', config: { plugboard: [] } })
    expect(s().activateSocket('B')).toBe('Connected V and B.')
    expect(s().pullPlug('Q')).toBe('Connected V and B.') // not plugged: nothing happens
  })
})

describe('fitsSlot', () => {
  it('knows which rotors each slot takes', async () => {
    const { fitsSlot } = await import('../../../src/state/machineStore.ts')
    const m4 = {
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'I', 'II', 'III'],
      rings: [0, 0, 0, 0],
      plugboard: [],
    } as const
    expect(fitsSlot(m4, 'Gamma', 0)).toBe(true)
    expect(fitsSlot(m4, 'Gamma', 3)).toBe(false)
    expect(fitsSlot(m4, 'VIII', 0)).toBe(false)
    expect(fitsSlot(m4, 'VIII', 2)).toBe(true)
    const enigmaI = {
      ...m4,
      model: 'I',
      reflector: 'B',
      rotors: ['I', 'II', 'III'],
      rings: [0, 0, 0],
    } as const
    expect(fitsSlot(enigmaI, 'VI', 1)).toBe(false)
    expect(fitsSlot(enigmaI, 'V', 0)).toBe(true)
  })
})

describe('setPositions', () => {
  it('sets all window letters at once, and refuses the wrong length', () => {
    const store = createMachineStore()
    expect(store.getState().setPositions('bla')).toEqual([])
    expect(store.getState().positions).toEqual([1, 11, 0])
    expect(store.getState().setPositions('AB')).toHaveLength(1)
    expect(store.getState().setPositions('A1C')).toHaveLength(1)
  })
})
