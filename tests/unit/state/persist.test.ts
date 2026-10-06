import { describe, expect, it } from 'vitest'
import { createMachineStore } from '../../../src/state/machineStore.ts'
import { loadSavedMachine, rememberMachine } from '../../../src/state/persist.ts'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('remembering the machine', () => {
  it('saves the setup, positions and box rings, and restores them', () => {
    const storage = memoryStorage()
    const store = createMachineStore()
    rememberMachine(store, storage)
    store.getState().setModel('M3')
    store.getState().setRotor(2, 'VIII')
    store.getState().setRing(0, 4)
    store.getState().setPositions('QEV')
    store.getState().setPlugboard(['AV', 'BS'])

    const saved = loadSavedMachine(storage)
    expect(saved).not.toBeNull()
    const restored = createMachineStore(saved!.config, saved!)
    expect(restored.getState().config).toEqual(store.getState().config)
    expect(restored.getState().positions).toEqual([16, 4, 21])
    expect(restored.getState().boxRings).toEqual({ III: 0 })
  })

  it('ignores missing, corrupt or invalid saves', () => {
    const storage = memoryStorage()
    expect(loadSavedMachine(storage)).toBeNull()
    storage.setItem('enigma.machine.v1', '{not json')
    expect(loadSavedMachine(storage)).toBeNull()
    storage.setItem(
      'enigma.machine.v1',
      JSON.stringify({
        config: {
          model: 'I',
          reflector: 'B',
          rotors: ['I', 'I', 'VI'],
          rings: [0, 0, 0],
          plugboard: [],
        },
        positions: [0, 0, 0],
        boxRings: {},
      }),
    )
    expect(loadSavedMachine(storage)).toBeNull()
    storage.setItem(
      'enigma.machine.v1',
      JSON.stringify({
        config: {
          model: 'I',
          reflector: 'B',
          rotors: ['I', 'II', 'III'],
          rings: [0, 0, 0],
          plugboard: [],
        },
        positions: [0, 0, 0],
        boxRings: { IV: 99 },
      }),
    )
    expect(loadSavedMachine(storage)).toBeNull()
    expect(loadSavedMachine(undefined)).toBeNull()
  })

  it('does not save when only the tape or lamps change', () => {
    const storage = memoryStorage()
    const store = createMachineStore()
    rememberMachine(store, storage)
    store.getState().clearTape()
    store.getState().setLidOpen(true)
    expect(storage.data.size).toBe(0)
  })

  it('reset returns to the defaults', () => {
    const store = createMachineStore()
    store.getState().setModel('M4')
    store.getState().keyDown('A')
    store.getState().setLidOpen(true)
    store.getState().reset()
    expect(store.getState()).toMatchObject({
      config: { model: 'I', rotors: ['I', 'II', 'III'] },
      positions: [0, 0, 0],
      heldKey: null,
      lidOpen: false,
      tape: { input: '', output: '', start: null },
    })
  })
})
