import { createStore, useStore } from 'zustand'
import {
  compile,
  MODELS,
  press,
  toIndex,
  validateConfig,
  type CompiledMachine,
  type MachineConfig,
  type ModelId,
  type ReflectorId,
  type RotorId,
  type Trace,
} from '../engine/index.ts'

/** Everything typed into and lit up by the machine since the tape was last cleared. */
export interface Tape {
  readonly input: string
  readonly output: string
  /** Rotor positions before the first letter on the tape, for "reset to start". */
  readonly start: readonly number[] | null
}

export interface MachineState {
  readonly config: MachineConfig
  readonly machine: CompiledMachine
  readonly positions: readonly number[]
  readonly lastTrace: Trace | null
  /** Key currently held down; the real machine locks the keyboard until it's released. */
  readonly heldKey: string | null
  /** Lamp lit by the held key. */
  readonly litLamp: string | null
  readonly tape: Tape
  /** Socket with a cable plugged in at one end only, waiting for its partner. */
  readonly plugSelection: string | null
  /** Plain-language status of the plugboard, shown under it and announced. */
  readonly plugMessage: string

  /** The setters return validation problems; an empty list means the change was applied. */
  setModel(model: ModelId): string[]
  setReflector(reflector: ReflectorId): string[]
  /** Choosing a rotor that's already in another slot swaps the two. */
  setRotor(slot: number, rotor: RotorId): string[]
  setRing(slot: number, ring: number): string[]
  setPosition(slot: number, position: number): string[]
  setPlugboard(pairs: readonly string[]): string[]
  /** Click/Enter on a plugboard socket: start, finish, cancel or remove a cable. Returns the new status. */
  activateSocket(letter: string): string
  /** Drops a half-plugged cable. Returns the new status, or null if nothing was pending. */
  cancelPlug(): string | null

  /** Presses a key: steps the rotors and lights a lamp. Ignored while another key is held. */
  keyDown(letter: string): Trace | null
  keyUp(): void
  /** Runs every letter of `text` through the machine and returns the result. */
  encipherText(text: string): string
  clearTape(): void
  /** Puts the rotors back where they were when the tape started. */
  resetToTapeStart(): void
}

const DEFAULTS: Record<ModelId, Pick<MachineConfig, 'reflector' | 'rotors'>> = {
  I: { reflector: 'B', rotors: ['I', 'II', 'III'] },
  M3: { reflector: 'B', rotors: ['I', 'II', 'III'] },
  M4: { reflector: 'B-thin', rotors: ['Beta', 'I', 'II', 'III'] },
}

export const INITIAL_CONFIG: MachineConfig = {
  model: 'I',
  ...DEFAULTS.I,
  rings: [0, 0, 0],
  plugboard: [],
}

const EMPTY_TAPE: Tape = { input: '', output: '', start: null }

export const MAX_CABLES = 13
const PLUG_PROMPT = 'Select a socket to start a cable.'

export function createMachineStore(config: MachineConfig = INITIAL_CONFIG) {
  return createStore<MachineState>()((set, get) => {
    /** Applies a new configuration (and optionally positions) if it's valid. */
    const apply = (next: MachineConfig, positions = get().positions): string[] => {
      const problems = validateConfig(next, positions)
      if (problems.length === 0) {
        set({ config: next, machine: compile(next), positions: [...positions] })
      }
      return problems
    }

    const patchSlot = <T>(values: readonly T[], slot: number, value: T) =>
      values.map((v, i) => (i === slot ? value : v))

    return {
      config,
      machine: compile(config),
      positions: config.rotors.map(() => 0),
      lastTrace: null,
      heldKey: null,
      litLamp: null,
      tape: EMPTY_TAPE,
      plugSelection: null,
      plugMessage: PLUG_PROMPT,

      setModel(model) {
        const current = get().config
        if (current.model === model) return []
        const spec = MODELS[model]
        // Keep the current rotors and reflector when the new model accepts them.
        let candidate: MachineConfig = {
          ...current,
          model,
          rings: Array<number>(spec.slots).fill(0),
        }
        if (current.rotors.length !== spec.slots) candidate = { ...candidate, ...DEFAULTS[model] }
        if (!spec.reflectors.includes(candidate.reflector)) {
          candidate = { ...candidate, reflector: DEFAULTS[model].reflector }
        }
        if (validateConfig(candidate).length > 0) {
          candidate = { ...candidate, rotors: DEFAULTS[model].rotors }
        }
        return apply(candidate, Array<number>(spec.slots).fill(0))
      },

      setReflector(reflector) {
        return apply({ ...get().config, reflector })
      },

      setRotor(slot, rotor) {
        const { config } = get()
        const other = config.rotors.indexOf(rotor)
        let rotors = patchSlot(config.rotors, slot, rotor)
        if (other >= 0 && other !== slot) rotors = patchSlot(rotors, other, config.rotors[slot])
        return apply({ ...config, rotors })
      },

      setRing(slot, ring) {
        const { config } = get()
        return apply({ ...config, rings: patchSlot(config.rings, slot, ring) })
      },

      setPosition(slot, position) {
        const { config, positions } = get()
        return apply(config, patchSlot(positions, slot, position))
      },

      setPlugboard(pairs) {
        return apply({ ...get().config, plugboard: [...pairs] })
      },

      activateSocket(letter) {
        const { config, plugSelection } = get()
        const pairs = config.plugboard
        const partner = pairs.find((p) => p.includes(letter))?.replace(letter, '')
        let message: string
        if (partner) {
          apply({ ...config, plugboard: pairs.filter((p) => !p.includes(letter)) })
          message = `Unplugged ${letter} from ${partner}.`
          set({ plugSelection: null })
        } else if (plugSelection === null) {
          // 13 cables fill all 26 sockets, so an empty socket always has a cable to spare.
          message = `Cable plugged into ${letter}. Select the socket to connect it to.`
          set({ plugSelection: letter })
        } else if (plugSelection === letter) {
          message = `Cancelled cable from ${letter}.`
          set({ plugSelection: null })
        } else {
          apply({ ...config, plugboard: [...pairs, plugSelection + letter] })
          message = `Connected ${plugSelection} and ${letter}.`
          set({ plugSelection: null })
        }
        set({ plugMessage: message })
        return message
      },

      cancelPlug() {
        const { plugSelection } = get()
        if (plugSelection === null) return null
        const message = `Cancelled cable from ${plugSelection}.`
        set({ plugSelection: null, plugMessage: message })
        return message
      },

      keyDown(letter) {
        const { heldKey, machine, positions, tape } = get()
        if (heldKey !== null) return null
        const trace = press(machine, positions, letter)
        set({
          heldKey: trace.input,
          litLamp: trace.output,
          lastTrace: trace,
          positions: [...trace.positionsAfter].map(toIndex),
          tape: {
            input: tape.input + trace.input,
            output: tape.output + trace.output,
            start: tape.start ?? positions,
          },
        })
        return trace
      },

      keyUp() {
        set({ heldKey: null, litLamp: null })
      },

      encipherText(text) {
        const { machine, tape } = get()
        const start = get().positions
        let positions = start
        let output = ''
        let input = ''
        let lastTrace: Trace | null = null
        for (const ch of text.toUpperCase()) {
          if (ch < 'A' || ch > 'Z') continue
          lastTrace = press(machine, positions, ch)
          positions = [...lastTrace.positionsAfter].map(toIndex)
          input += ch
          output += lastTrace.output
        }
        if (lastTrace) {
          set({
            positions,
            lastTrace,
            tape: {
              input: tape.input + input,
              output: tape.output + output,
              start: tape.start ?? start,
            },
          })
        }
        return output
      },

      clearTape() {
        set({ tape: EMPTY_TAPE })
      },

      resetToTapeStart() {
        const { tape } = get()
        if (tape.start) set({ positions: tape.start, tape: EMPTY_TAPE, lastTrace: null })
      },
    }
  })
}

export type MachineStore = ReturnType<typeof createMachineStore>

export const machineStore = createMachineStore()

export function useMachine<T>(selector: (state: MachineState) => T): T {
  return useStore(machineStore, selector)
}
