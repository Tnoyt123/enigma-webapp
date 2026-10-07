import { createStore, useStore } from 'zustand'
import { slotNames } from '../teaching/explain.ts'
import { loadSavedMachine, rememberMachine } from './persist.ts'
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
  /**
   * Where the last whole-message run began on the tape, so it can be read from its start;
   * null once a key is pressed.
   */
  readonly runFrom: number | null
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
  /** The machine's lid is open: rotors can be lifted out and swapped with the rotor box. */
  readonly lidOpen: boolean
  /** A rotor lifted out of its slot or the box, waiting to be put down. Keys don't work meanwhile. */
  readonly hand: RotorInHand | null
  /** Slot whose ring is being set in the close-up, if any. */
  readonly ringSlot: number | null
  /** Plain-language status of the rotor bay, shown in it and announced. */
  readonly rotorMessage: string
  /** Ring settings of rotors in the box (rings belong to rotors); missing means A. */
  readonly boxRings: Readonly<Partial<Record<RotorId, number>>>

  /** The setters return validation problems; an empty list means the change was applied. */
  setModel(model: ModelId): string[]
  setReflector(reflector: ReflectorId): string[]
  /**
   * Puts a rotor in a slot. One already in another slot swaps with it; one from the box replaces
   * the slot's rotor. Ring settings travel with their rotors; positions stay with the slots.
   */
  setRotor(slot: number, rotor: RotorId): string[]
  setRing(slot: number, ring: number): string[]
  setPosition(slot: number, position: number): string[]
  /** Sets every rotor at once from window letters, e.g. "BLA". */
  setPositions(letters: string): string[]
  setPlugboard(pairs: readonly string[]): string[]
  /** Click/Enter on a plugboard socket: start, finish, cancel or remove a cable. Returns the new status. */
  activateSocket(letter: string): string
  /** Pulls the plug out of a plugged socket; the cable's other end stays in. Returns the new status. */
  pullPlug(letter: string): string
  /** Drops a half-plugged cable. Returns the new status, or null if nothing was pending. */
  cancelPlug(): string | null

  /**
   * Sets up the whole machine at once, e.g. from a historical key sheet: config and window
   * letters, with an empty tape, the lid closed and no cable or rotor in hand. Returns problems.
   */
  loadSetup(config: MachineConfig, positions: string): string[]
  /** Back to the initial Enigma I setup, with an empty tape and the lid closed. */
  reset(): void
  /** Opens or closes the lid. Closing puts back any rotor in hand and ends the ring close-up. */
  setLidOpen(open: boolean): string
  /** Lifts the rotor from a slot, or the given rotor from the box. Returns the new status. */
  liftRotor(from: number | 'box', rotor?: RotorId): string
  /** Puts the rotor in hand into a slot, swapping or replacing what's there. Returns the new status. */
  placeRotor(slot: number): string
  /** Puts the rotor in hand back where it came from. Returns the new status, or null if empty-handed. */
  returnRotor(): string | null
  /** Opens the ring-setting close-up for a slot (null closes it), putting back any rotor in hand. */
  setRingSlot(slot: number | null): void

  /** Presses a key: steps the rotors and lights a lamp. Ignored while another key is held or a rotor is in hand. */
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

const EMPTY_TAPE: Tape = { input: '', output: '', start: null, runFrom: null }

export interface RotorInHand {
  readonly rotor: RotorId
  /** Slot it was lifted from, or 'box'. */
  readonly from: number | 'box'
}

/** Rotors that fit this model but aren't in the machine: the contents of the rotor box. */
export function boxRotors(config: MachineConfig): RotorId[] {
  const model = MODELS[config.model]
  return [...model.thinRotors, ...model.rotors].filter((id) => !config.rotors.includes(id))
}

/** Whether a model accepts this rotor in this slot (the M4's leftmost slot takes thin rotors only). */
export function fitsSlot(config: MachineConfig, rotor: RotorId, slot: number): boolean {
  const model = MODELS[config.model]
  const thinSlot = model.slots === 4 && slot === 0
  return (thinSlot ? model.thinRotors : model.rotors).includes(rotor)
}

export const MAX_CABLES = 13
const PLUG_PROMPT = 'Select a socket to start a cable.'
const ROTOR_PROMPT = 'Lift a rotor out of the machine or the box, then choose where to put it.'

/** The part of the machine worth remembering between visits. */
export interface SavedMachine {
  readonly config: MachineConfig
  readonly positions: readonly number[]
  readonly boxRings: Readonly<Partial<Record<RotorId, number>>>
}

export function createMachineStore(
  config: MachineConfig = INITIAL_CONFIG,
  saved?: Omit<SavedMachine, 'config'>,
) {
  return createStore<MachineState>()((set, get) => {
    /** Applies a new configuration (and optionally positions) if it's valid. */
    const apply = (next: MachineConfig, positions = get().positions): string[] => {
      const problems = validateConfig(next, positions)
      if (problems.length === 0) {
        // The last trace described the old setup; its drawn path would no longer match.
        set({ config: next, machine: compile(next), positions: [...positions], lastTrace: null })
      }
      return problems
    }

    const patchSlot = <T>(values: readonly T[], slot: number, value: T) =>
      values.map((v, i) => (i === slot ? value : v))

    return {
      config,
      machine: compile(config),
      positions: saved?.positions ?? config.rotors.map(() => 0),
      lastTrace: null,
      heldKey: null,
      litLamp: null,
      tape: EMPTY_TAPE,
      plugSelection: null,
      plugMessage: PLUG_PROMPT,
      lidOpen: false,
      hand: null,
      ringSlot: null,
      rotorMessage: ROTOR_PROMPT,
      boxRings: saved?.boxRings ?? {},

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
        const problems = apply(candidate, Array<number>(spec.slots).fill(0))
        if (problems.length === 0) set({ boxRings: {} })
        return problems
      },

      setReflector(reflector) {
        return apply({ ...get().config, reflector })
      },

      setRotor(slot, rotor) {
        // The ring setting belongs to the rotor, so it moves with it: two rotors swapped in the
        // machine swap rings, and a rotor going into the box keeps its ring for next time.
        const { config, boxRings } = get()
        const displaced = config.rotors[slot]
        if (displaced === rotor) return []
        const other = config.rotors.indexOf(rotor)
        let rotors = patchSlot(config.rotors, slot, rotor)
        let rings = config.rings
        let nextBoxRings = boxRings
        if (other >= 0) {
          rotors = patchSlot(rotors, other, displaced)
          rings = patchSlot(patchSlot(rings, slot, config.rings[other]), other, config.rings[slot])
        } else {
          rings = patchSlot(rings, slot, boxRings[rotor] ?? 0)
          nextBoxRings = { ...boxRings, [displaced]: config.rings[slot] }
          delete nextBoxRings[rotor]
        }
        const problems = apply({ ...config, rotors, rings })
        if (problems.length === 0) set({ boxRings: nextBoxRings })
        return problems
      },

      setRing(slot, ring) {
        const { config } = get()
        return apply({ ...config, rings: patchSlot(config.rings, slot, ring) })
      },

      setPosition(slot, position) {
        const { config, positions } = get()
        return apply(config, patchSlot(positions, slot, position))
      },

      setPositions(letters) {
        const positions = [...letters.toUpperCase()].map((ch) =>
          ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 65 : -1,
        )
        return apply(get().config, positions)
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

      pullPlug(letter) {
        const { config } = get()
        const pair = config.plugboard.find((p) => p.includes(letter))
        if (!pair) return get().plugMessage
        const partner = pair.replace(letter, '')
        apply({ ...config, plugboard: config.plugboard.filter((p) => p !== pair) })
        const message = `Pulled the plug out of ${letter}; the cable is still in ${partner}. Choose a socket for it.`
        set({ plugSelection: partner, plugMessage: message })
        return message
      },

      cancelPlug() {
        const { plugSelection } = get()
        if (plugSelection === null) return null
        const message = `Cancelled cable from ${plugSelection}.`
        set({ plugSelection: null, plugMessage: message })
        return message
      },

      loadSetup(next, letters) {
        const problems = apply(next, [...letters.toUpperCase()].map(toIndex))
        if (problems.length > 0) return problems
        set({
          heldKey: null,
          litLamp: null,
          tape: EMPTY_TAPE,
          plugSelection: null,
          plugMessage: PLUG_PROMPT,
          lidOpen: false,
          hand: null,
          ringSlot: null,
          rotorMessage: ROTOR_PROMPT,
          boxRings: {},
        })
        return []
      },

      reset() {
        set({
          config: INITIAL_CONFIG,
          machine: compile(INITIAL_CONFIG),
          positions: INITIAL_CONFIG.rotors.map(() => 0),
          lastTrace: null,
          heldKey: null,
          litLamp: null,
          tape: EMPTY_TAPE,
          plugSelection: null,
          plugMessage: PLUG_PROMPT,
          lidOpen: false,
          hand: null,
          ringSlot: null,
          rotorMessage: ROTOR_PROMPT,
          boxRings: {},
        })
      },

      setLidOpen(open) {
        const message = open
          ? ROTOR_PROMPT
          : get().hand
            ? `Put rotor ${get().hand!.rotor} back and closed the lid.`
            : 'Closed the lid.'
        set({ lidOpen: open, hand: null, ringSlot: null, rotorMessage: message })
        return message
      },

      liftRotor(from, rotor) {
        const id = from === 'box' ? rotor : get().config.rotors[from]
        if (!id) return get().rotorMessage
        const names = slotNames(get().config.rotors.length)
        const message =
          from === 'box'
            ? `Holding rotor ${id} from the box. Choose a slot to put it in.`
            : `Lifted rotor ${id} out of the ${names[from].toLowerCase()} slot. Choose where to put it.`
        set({ hand: { rotor: id, from }, ringSlot: null, rotorMessage: message })
        return message
      },

      placeRotor(slot) {
        const { hand, config } = get()
        if (!hand) return get().liftRotor(slot)
        const names = slotNames(config.rotors.length)
        const where = `the ${names[slot].toLowerCase()} slot`
        let message: string
        if (hand.from === slot) {
          message = `Put rotor ${hand.rotor} back in ${where}.`
        } else {
          const displaced = config.rotors[slot]
          const problems = get().setRotor(slot, hand.rotor)
          if (problems.length > 0) {
            message = problems[0] // keep holding it
            set({ rotorMessage: message })
            return message
          }
          message =
            hand.from === 'box'
              ? `Rotor ${hand.rotor} is in ${where}; rotor ${displaced} went back to the box.`
              : `Rotor ${hand.rotor} is in ${where}; rotor ${displaced} moved to the ${names[hand.from].toLowerCase()} slot.`
        }
        set({ hand: null, rotorMessage: message })
        return message
      },

      returnRotor() {
        const { hand, config } = get()
        if (!hand) return null
        const message =
          hand.from === 'box'
            ? `Put rotor ${hand.rotor} back in the box.`
            : `Put rotor ${hand.rotor} back in the ${slotNames(config.rotors.length)[hand.from].toLowerCase()} slot.`
        set({ hand: null, rotorMessage: message })
        return message
      },

      setRingSlot(slot) {
        // A rotor in hand goes back where it came from before the close-up opens.
        if (slot !== null) get().returnRotor()
        set({ ringSlot: slot })
      },

      keyDown(letter) {
        const { heldKey, machine, positions, tape } = get()
        if (heldKey !== null) return null
        if (get().hand) {
          set({
            rotorMessage: `Put rotor ${get().hand!.rotor} down before typing: the circuit is broken.`,
          })
          return null
        }
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
            runFrom: null,
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
              runFrom: tape.output.length,
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

const saved = loadSavedMachine()
export const machineStore = saved ? createMachineStore(saved.config, saved) : createMachineStore()
rememberMachine(machineStore)

export function useMachine<T>(selector: (state: MachineState) => T): T {
  return useStore(machineStore, selector)
}
