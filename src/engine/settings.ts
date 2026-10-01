import { toIndex } from './alphabet.ts'
import type { ModelId } from './data/models.ts'
import type { ReflectorId } from './data/reflectors.ts'
import type { RotorId } from './data/rotors.ts'
import type { MachineConfig } from './machine.ts'
import { parsePlugboard } from './plugboard.ts'

/** Key-sheet style settings as an operator would read them. */
export interface KeySheet {
  readonly model: ModelId
  readonly reflector: ReflectorId
  /** e.g. "II IV V" or, for the M4, "Beta II IV I". */
  readonly rotors: string
  /** Letters ("BUL") or 1-based numbers ("02 21 12"). */
  readonly rings: string
  /** e.g. "AV BS CG". */
  readonly plugboard?: string
}

/** Parses ring settings written as letters ("BUL") or numbers 01–26 ("02 21 12"). */
export function parseRings(text: string): number[] {
  const trimmed = text.trim()
  if (/^[\d\s]+$/.test(trimmed)) return trimmed.split(/\s+/).map((n) => Number(n) - 1)
  return [...trimmed.replace(/\s+/g, '')].map(toIndex)
}

export function fromKeySheet(sheet: KeySheet): MachineConfig {
  return {
    model: sheet.model,
    reflector: sheet.reflector,
    rotors: sheet.rotors.trim().split(/\s+/) as RotorId[],
    rings: parseRings(sheet.rings),
    plugboard: parsePlugboard(sheet.plugboard ?? ''),
  }
}
