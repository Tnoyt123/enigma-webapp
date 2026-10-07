// Public API of the cipher engine. Pure TypeScript: no DOM, no React, no dependencies.
export { ALPHABET, mod26, toIndex, toLetter } from './alphabet.ts'
export { HISTORICAL_MESSAGES, type HistoricalMessage } from './data/messages.ts'
export { MODELS, type ModelId, type ModelSpec } from './data/models.ts'
export { REFLECTORS, type ReflectorId, type ReflectorSpec } from './data/reflectors.ts'
export { ROTORS, type RotorId, type RotorSpec } from './data/rotors.ts'
export {
  compile,
  ConfigError,
  EnigmaMachine,
  press,
  step,
  validateConfig,
  type CompiledMachine,
  type MachineConfig,
  type StepResult,
} from './machine.ts'
export { parsePlugboard, plugboardMap } from './plugboard.ts'
export {
  BIGRAM_TABLE,
  disguiseIndicator,
  PROCEDURES,
  receiveMessage,
  revealIndicator,
  sendMessage,
  toGroups,
  type ProcedureId,
  type ProcedureInfo,
  type ProcedureStep,
  type RadioMessage,
  type ReceivedMessage,
} from './procedure.ts'
export { fromKeySheet, parseRings, type KeySheet } from './settings.ts'
export type { Stage, Trace } from './trace.ts'
