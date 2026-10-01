import { createStore, useStore } from 'zustand'
import { machineStore } from './machineStore.ts'

export const STEP_SPEEDS = [
  { label: 'Slow', seconds: 2.5 },
  { label: 'Normal', seconds: 1.2 },
  { label: 'Fast', seconds: 0.5 },
] as const

export interface TeachingState {
  /** X-ray: show the inside of the machine and the path the current took. */
  readonly xray: boolean
  /** Walk through each key press one stage at a time instead of showing it all at once. */
  readonly stepMode: boolean
  /** Index into the walkthrough of the last key press (see teaching/explain.ts `reveal`). */
  readonly cursor: number
  /** Advance automatically through the walkthrough. */
  readonly playing: boolean
  readonly secondsPerStep: number

  setXray(on: boolean): void
  setStepMode(on: boolean): void
  next(): void
  previous(): void
  restart(): void
  setPlaying(on: boolean): void
  setSecondsPerStep(seconds: number): void
}

/** Steps in the walkthrough of the current trace: the stepping, each stage, then the lamp. */
export function stepCount(): number {
  const trace = machineStore.getState().lastTrace
  return trace ? trace.stages.length + 2 : 0
}

const END = Number.MAX_SAFE_INTEGER

export function createTeachingStore() {
  const store = createStore<TeachingState>()((set, get) => ({
    xray: false,
    stepMode: false,
    cursor: END,
    playing: false,
    secondsPerStep: STEP_SPEEDS[1].seconds,

    setXray(on) {
      set({ xray: on })
    },
    setStepMode(on) {
      // Turning step mode on replays the last key press from the start; off shows it whole.
      set({ stepMode: on, cursor: on ? 0 : END, playing: on ? get().playing : false })
    },
    next() {
      set({ cursor: Math.min(get().cursor + 1, Math.max(stepCount() - 1, 0)) })
    },
    previous() {
      set({ cursor: Math.max(Math.min(get().cursor, stepCount() - 1) - 1, 0) })
    },
    restart() {
      set({ cursor: 0 })
    },
    setPlaying(on) {
      // Pressing play at the end starts the walkthrough again.
      const atEnd = get().cursor >= stepCount() - 1
      set({ playing: on, ...(on && atEnd ? { cursor: 0 } : {}) })
    },
    setSecondsPerStep(seconds) {
      set({ secondsPerStep: seconds })
    },
  }))

  // Each new key press starts its walkthrough from the beginning in step mode.
  machineStore.subscribe((state, previous) => {
    if (state.lastTrace !== previous.lastTrace) {
      store.setState({ cursor: store.getState().stepMode ? 0 : END })
    }
  })
  return store
}

export const teachingStore = createTeachingStore()

export function useTeaching<T>(selector: (state: TeachingState) => T): T {
  return useStore(teachingStore, selector)
}
