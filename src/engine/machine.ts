import { ALPHABET, mod26, toIndex, toLetter } from './alphabet.ts'
import { MODELS, type ModelId } from './data/models.ts'
import { REFLECTORS, type ReflectorId } from './data/reflectors.ts'
import { ROTORS, type RotorId, type RotorSpec } from './data/rotors.ts'
import { plugboardMap } from './plugboard.ts'
import type { Stage, Trace } from './trace.ts'

/** The day's key: what an operator would set up from the key sheet, minus starting positions. */
export interface MachineConfig {
  readonly model: ModelId
  readonly reflector: ReflectorId
  /** Rotors left to right. On the M4 the first is the thin rotor. */
  readonly rotors: readonly RotorId[]
  /** Ring setting per rotor, left to right: 0 = A (01) … 25 = Z (26). */
  readonly rings: readonly number[]
  /** Plugboard cables as letter pairs, e.g. ['AV', 'BS']. */
  readonly plugboard: readonly string[]
}

export class ConfigError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`Invalid Enigma configuration:\n- ${problems.join('\n- ')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

/** "A", "A or B", "A, B or C". */
function listOf(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
}

/** Returns a list of human-readable problems; empty means the configuration is valid. */
export function validateConfig(config: MachineConfig, positions?: readonly number[]): string[] {
  const problems: string[] = []
  const model = MODELS[config.model]
  if (!model) return [`Unknown model "${config.model}".`]

  if (!model.reflectors.includes(config.reflector)) {
    problems.push(
      `${model.name} takes reflector ${listOf(model.reflectors.map((r) => REFLECTORS[r].name))}, not "${config.reflector}".`,
    )
  }

  if (config.rotors.length !== model.slots) {
    problems.push(`${model.name} needs ${model.slots} rotors, got ${config.rotors.length}.`)
  } else {
    config.rotors.forEach((id, slot) => {
      const thinSlot = model.slots === 4 && slot === 0
      const allowed = thinSlot ? model.thinRotors : model.rotors
      if (!allowed.includes(id)) {
        problems.push(
          thinSlot
            ? `The leftmost ${model.name} slot takes a thin rotor (${listOf(allowed)}), not "${id}".`
            : `Rotor "${id}" can't be used in slot ${slot + 1} of the ${model.name}; choose from ${listOf(allowed)}.`,
        )
      }
    })
    const seen = new Set<RotorId>()
    for (const id of config.rotors) {
      if (seen.has(id)) problems.push(`Rotor ${id} is used twice; each machine had one of each.`)
      seen.add(id)
    }
  }

  const checkSettings = (label: string, values: readonly number[]) => {
    if (values.length !== config.rotors.length) {
      problems.push(`Expected ${config.rotors.length} ${label}, got ${values.length}.`)
    } else if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 25)) {
      problems.push(`Each of the ${label} must be a letter A–Z (0–25).`)
    }
  }
  checkSettings('ring settings', config.rings)
  if (positions) checkSettings('rotor positions', positions)

  if (config.plugboard.length > 13) {
    problems.push(`At most 13 plugboard cables fit; got ${config.plugboard.length}.`)
  }
  const plugged = new Set<string>()
  for (const pair of config.plugboard) {
    if (!/^[A-Z]{2}$/.test(pair)) {
      problems.push(`Plugboard pair "${pair}" must be two letters A–Z.`)
      continue
    }
    if (pair[0] === pair[1]) problems.push(`Plugboard pair "${pair}" connects a letter to itself.`)
    for (const letter of new Set(pair)) {
      if (plugged.has(letter)) problems.push(`Plugboard socket ${letter} is used by two cables.`)
      plugged.add(letter)
    }
  }
  return problems
}

interface CompiledRotor {
  readonly spec: RotorSpec
  readonly forward: readonly number[]
  readonly backward: readonly number[]
  readonly notches: readonly number[]
}

/** A validated configuration with its wiring tables precomputed. */
export interface CompiledMachine {
  readonly config: MachineConfig
  readonly rotors: readonly CompiledRotor[]
  readonly reflector: readonly number[]
  readonly plugboard: readonly number[]
}

function compileRotor(spec: RotorSpec): CompiledRotor {
  const forward = [...spec.wiring].map(toIndex)
  const backward = new Array<number>(26)
  forward.forEach((out, i) => (backward[out] = i))
  return { spec, forward, backward, notches: [...spec.notches].map(toIndex) }
}

/** Validates and precomputes a configuration. Throws ConfigError if it isn't a legal setup. */
export function compile(config: MachineConfig): CompiledMachine {
  const problems = validateConfig(config)
  if (problems.length > 0) throw new ConfigError(problems)
  return {
    config,
    rotors: config.rotors.map((id) => compileRotor(ROTORS[id])),
    reflector: [...REFLECTORS[config.reflector].wiring].map(toIndex),
    plugboard: plugboardMap(config.plugboard),
  }
}

export interface StepResult {
  readonly positions: number[]
  readonly stepped: boolean[]
  readonly doubleStep: boolean
}

/**
 * Advances the rotors as a key press does, before the signal flows.
 *
 * Only the three rightmost rotors step. Each pawl pushes on the ratchet of its own
 * rotor and, if it drops into the notch of the rotor to its right, on that notch too.
 * The middle pawl therefore moves the middle rotor whenever the middle rotor itself
 * sits at its notch, so the middle rotor steps on two consecutive presses: the
 * double-stepping anomaly.
 */
export function step(machine: CompiledMachine, positions: readonly number[]): StepResult {
  const n = positions.length
  const [l, m, r] = [n - 3, n - 2, n - 1]
  const atNotch = (slot: number) => machine.rotors[slot].notches.includes(positions[slot])

  const middleAtNotch = atNotch(m)
  const stepped = positions.map(() => false)
  stepped[r] = true
  stepped[m] = atNotch(r) || middleAtNotch
  stepped[l] = middleAtNotch

  return {
    positions: positions.map((p, slot) => (stepped[slot] ? mod26(p + 1) : p)),
    stepped,
    doubleStep: middleAtNotch,
  }
}

/** Presses one key: steps the rotors, then traces the current from keyboard to lamp. */
export function press(machine: CompiledMachine, positions: readonly number[], key: string): Trace {
  const input = toIndex(key)
  const { positions: after, stepped, doubleStep } = step(machine, positions)
  const stages: Stage[] = []
  let signal = input

  const plug = (direction: 'forward' | 'backward') => {
    const out = machine.plugboard[signal]
    stages.push({
      component: 'plugboard',
      direction,
      input: toLetter(signal),
      output: toLetter(out),
      swapped: out !== signal,
    })
    signal = out
  }
  // The entry wheel (Eintrittswalze) of the I, M3 and M4 is wired straight through.
  const entry = (direction: 'forward' | 'backward') =>
    stages.push({
      component: 'entry',
      direction,
      input: toLetter(signal),
      output: toLetter(signal),
    })

  const rotor = (slot: number, direction: 'forward' | 'backward') => {
    const { spec, forward, backward } = machine.rotors[slot]
    const ring = machine.config.rings[slot]
    const offset = after[slot] - ring
    const coreIn = mod26(signal + offset)
    const coreOut = (direction === 'forward' ? forward : backward)[coreIn]
    const out = mod26(coreOut - offset)
    stages.push({
      component: 'rotor',
      direction,
      slot,
      rotor: spec.id,
      input: toLetter(signal),
      output: toLetter(out),
      coreInput: toLetter(coreIn),
      coreOutput: toLetter(coreOut),
      position: toLetter(after[slot]),
      ring: toLetter(ring),
    })
    signal = out
  }

  plug('forward')
  entry('forward')
  for (let slot = after.length - 1; slot >= 0; slot--) rotor(slot, 'forward')
  const reflected = machine.reflector[signal]
  stages.push({
    component: 'reflector',
    reflector: machine.config.reflector,
    input: toLetter(signal),
    output: toLetter(reflected),
  })
  signal = reflected
  for (let slot = 0; slot < after.length; slot++) rotor(slot, 'backward')
  entry('backward')
  plug('backward')

  return {
    input: toLetter(input),
    output: toLetter(signal),
    positionsBefore: positions.map(toLetter).join(''),
    positionsAfter: after.map(toLetter).join(''),
    stepped,
    doubleStep,
    stages,
  }
}

/** Convenience wrapper holding a compiled configuration and the current rotor positions. */
export class EnigmaMachine {
  readonly machine: CompiledMachine
  #positions: number[]

  constructor(
    config: MachineConfig,
    positions: readonly number[] | string = 'A'.repeat(config.rotors.length),
  ) {
    const pos = typeof positions === 'string' ? [...positions].map(toIndex) : [...positions]
    const problems = validateConfig(config, pos)
    if (problems.length > 0) throw new ConfigError(problems)
    this.machine = compile(config)
    this.#positions = pos
  }

  get config(): MachineConfig {
    return this.machine.config
  }

  /** Window letters, left to right. */
  get positions(): string {
    return this.#positions.map(toLetter).join('')
  }

  setPositions(positions: string): void {
    const pos = [...positions].map(toIndex)
    const problems = validateConfig(this.config, pos)
    if (problems.length > 0) throw new ConfigError(problems)
    this.#positions = pos
  }

  press(key: string): Trace {
    const trace = press(this.machine, this.#positions, key)
    this.#positions = [...trace.positionsAfter].map(toIndex)
    return trace
  }

  /** Enciphers (or deciphers — it's the same operation) the letters A–Z in `text`; everything else is dropped. */
  encipher(text: string): string {
    let out = ''
    for (const ch of text.toUpperCase()) {
      if (ALPHABET.includes(ch)) out += this.press(ch).output
    }
    return out
  }
}
