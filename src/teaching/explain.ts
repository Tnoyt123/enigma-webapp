import {
  mod26,
  REFLECTORS,
  ROTORS,
  toIndex,
  type MachineConfig,
  type Stage,
  type Trace,
} from '../engine/index.ts'

/** One step of the step-by-step walkthrough of a key press. */
export interface LessonStep {
  readonly title: string
  readonly detail: string
  /** What to highlight: the stepping before the current flows, a trace stage, or the lamp. */
  readonly focus: 'press' | 'lamp' | number
}

export function slotNames(slots: number): string[] {
  return slots === 4 ? ['Thin', 'Left', 'Middle', 'Right'] : ['Left', 'Middle', 'Right']
}

/**
 * The walkthrough for one key press: the rotors stepping, then every stage the current
 * passes through (in trace order), then the lamp. Always `trace.stages.length + 2` steps.
 */
export function lessonSteps(trace: Trace, config: MachineConfig): LessonStep[] {
  return [
    {
      title: `Key ${trace.input} pressed: the rotors step`,
      detail: steppingText(trace, config),
      focus: 'press',
    },
    ...trace.stages.map((stage, i) => ({ ...stageText(stage, config), focus: i })),
    {
      title: `Lamp ${trace.output} lights`,
      detail:
        `Pressing ${trace.input} lit ${trace.output}. The path is reversible: pressing ${trace.output} ` +
        `with the rotors in the same positions would light ${trace.input}, which is why the same ` +
        `settings both encrypt and decrypt.`,
      focus: 'lamp',
    },
  ]
}

function steppingText(trace: Trace, config: MachineConfig): string {
  const names = slotNames(config.rotors.length)
  const n = config.rotors.length
  const [l, m, r] = [n - 3, n - 2, n - 1]
  const before = trace.positionsBefore
  const notchOf = (slot: number) => ROTORS[config.rotors[slot]].notches.split('').join(' or ')
  const moved = (slot: number) =>
    `the ${names[slot].toLowerCase()} rotor (${config.rotors[slot]}) turns ${before[slot]} → ${trace.positionsAfter[slot]}`

  const parts = [
    `Before any current flows, the key pushes the stepping pawls: ${moved(r)}, as it does on every key press.`,
  ]
  if (trace.stepped[m]) {
    parts.push(
      trace.doubleStep
        ? `${capitalise(moved(m))} because it was itself at its notch letter (${notchOf(m)}): this is the double step.`
        : `${capitalise(moved(m))} because the right rotor was at its notch letter (${notchOf(r)}).`,
    )
  }
  if (trace.stepped[l]) {
    parts.push(
      `${capitalise(moved(l))} because the middle rotor was at its notch letter (${notchOf(m)}).`,
    )
  }
  if (n === 4) parts.push('The thin fourth rotor never steps.')
  return parts.join(' ')
}

function stageText(stage: Stage, config: MachineConfig): Omit<LessonStep, 'focus'> {
  switch (stage.component) {
    case 'plugboard': {
      const first = stage.direction === 'forward'
      const where = first ? 'on its way in' : 'on its way out to the lamps'
      return {
        title: first ? 'Plugboard (in)' : 'Plugboard (out)',
        detail: stage.swapped
          ? `A cable joins sockets ${stage.input} and ${stage.output}, so ${where} the current is swapped from ${stage.input} to ${stage.output}.`
          : `Nothing is plugged into socket ${stage.input}, so ${where} the current passes straight through as ${stage.input}.`,
      }
    }
    case 'entry':
      return stage.direction === 'forward'
        ? {
            title: 'Entry wheel (in)',
            detail: `The entry wheel (Eintrittswalze) is wired straight through, so the current enters the rotors on contact ${stage.input}.`,
          }
        : {
            title: 'Entry wheel (out)',
            detail: `Back through the entry wheel, still wired straight through: the current leaves the rotors on contact ${stage.output}.`,
          }
    case 'rotor': {
      const name = slotNames(config.rotors.length)[stage.slot]
      const offset = mod26(toIndex(stage.position) - toIndex(stage.ring))
      const returning = stage.direction === 'backward'
      const turned =
        offset === 0
          ? `Its window shows ${stage.position} and its ring is set to ${stage.ring}, so the wiring is not turned at all`
          : `Its window shows ${stage.position} and its ring is set to ${stage.ring}, so its wiring is turned ${offset} step${offset === 1 ? '' : 's'} (position − ring)`
      return {
        title: `${name} rotor (${stage.rotor})${returning ? ', returning' : ''}`,
        detail:
          `${turned}. The current arrives on contact ${stage.input}, which meets the rotor's own wiring at ${stage.coreInput}. ` +
          (returning
            ? `Travelling back, it follows that wire in reverse to ${stage.coreOutput}`
            : `That wire leads to ${stage.coreOutput}`) +
          `, which lines up with contact ${stage.output}.`,
      }
    }
    case 'reflector':
      return {
        title: `Reflector (${REFLECTORS[stage.reflector].name})`,
        detail:
          `The reflector connects ${stage.input} to ${stage.output} and sends the current back through the rotors by a different path. ` +
          `Every contact is paired with a different one, so a letter can never encrypt to itself.`,
      }
  }
}

/** Plain-language account of a double step, or null if this press didn't involve one. */
export function doubleStepText(trace: Trace, config: MachineConfig): string | null {
  if (!trace.doubleStep) return null
  const n = config.rotors.length
  const [l, m] = [n - 3, n - 2]
  const middle = config.rotors[m]
  return (
    `Double step! The middle rotor (${middle}) was showing ${trace.positionsBefore[m]}, its notch letter, ` +
    `so the middle pawl caught its notch: it pushed the middle rotor on again (${trace.positionsBefore[m]} → ${trace.positionsAfter[m]}) ` +
    `and carried the left rotor (${config.rotors[l]}) with it (${trace.positionsBefore[l]} → ${trace.positionsAfter[l]}). ` +
    `Normally the middle rotor moves only when the right rotor passes its notch, so it has now moved on two key presses in a row. ` +
    `This quirk is why a three-rotor Enigma repeats after 16,900 key presses rather than 26 × 26 × 26 = 17,576.`
  )
}

function capitalise(s: string): string {
  return s[0].toUpperCase() + s.slice(1)
}

/**
 * What the current step of a walkthrough reveals. `cursor` 0 is the key press (no current yet),
 * 1…stageCount reveal stages up to cursor−1, and stageCount+1 adds the lamp.
 */
export function reveal(cursor: number, stageCount: number) {
  const c = Math.max(0, Math.min(cursor, stageCount + 1))
  return {
    /** Number of trace stages whose path is drawn. */
    stages: Math.min(c, stageCount),
    lamp: c === stageCount + 1,
    focus: (c === 0 ? 'press' : c === stageCount + 1 ? 'lamp' : c - 1) as 'press' | 'lamp' | number,
  }
}
