import { ROTORS, validateConfig, type RotorId } from '../engine/index.ts'
import type { MachineState, SavedMachine } from './machineStore.ts'
import type { StoreApi } from 'zustand'

/** Bump the version if the saved shape changes; older entries are then ignored. */
const STORAGE_KEY = 'enigma.machine.v1'

/** The machine as last left on this device, if a valid one was saved. Never throws. */
export function loadSavedMachine(
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage(),
): SavedMachine | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedMachine
    if (validateConfig(data.config, data.positions).length > 0) return null
    const ringsOk = Object.entries(data.boxRings ?? {}).every(
      ([id, ring]) => id in ROTORS && Number.isInteger(ring) && ring >= 0 && ring < 26,
    )
    if (!ringsOk) return null
    return { config: data.config, positions: data.positions, boxRings: data.boxRings ?? {} }
  } catch {
    return null
  }
}

/** Saves the key-sheet setup, rotor positions and box rings whenever they change. */
export function rememberMachine(
  store: StoreApi<MachineState>,
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage(),
): () => void {
  if (!storage) return () => {}
  return store.subscribe((s, previous) => {
    if (
      s.config === previous.config &&
      s.positions === previous.positions &&
      s.boxRings === previous.boxRings
    ) {
      return
    }
    const saved: SavedMachine = {
      config: s.config,
      positions: s.positions,
      boxRings: s.boxRings as Partial<Record<RotorId, number>>,
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // Storage full or blocked: settings just aren't remembered.
    }
  })
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
