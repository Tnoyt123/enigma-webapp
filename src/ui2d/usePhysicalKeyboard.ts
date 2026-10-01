import { useEffect } from 'react'
import type { Trace } from '../engine/index.ts'
import { machineStore } from '../state/machineStore.ts'
import { announce } from './announce.ts'

/**
 * Elements that use letter keys themselves, so typing there must not press machine keys.
 * Checkboxes, radios and buttons don't, so the machine keeps working after using a switch.
 */
const OWN_LETTER_KEYS = [
  'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="range"])',
  'textarea',
  'select',
  '[contenteditable]',
  '[role="spinbutton"]',
  '[data-own-letter-keys]',
].join(', ')

/** Announces a key press for screen-reader users. */
export function announcePress(trace: Trace) {
  const rotors = [...trace.positionsAfter].join(' ')
  const extra = trace.doubleStep ? ' Double step: the middle rotor moved again.' : ''
  announce(`${trace.input} lights ${trace.output}. Rotors ${rotors}.${extra}`)
}

/** Lets the computer keyboard act as the Enigma keyboard while focus isn't in a text field. */
export function usePhysicalKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z]$/i.test(e.key)) return
      if (e.target instanceof Element && e.target.closest(OWN_LETTER_KEYS)) return
      e.preventDefault()
      if (e.repeat) return
      const trace = machineStore.getState().keyDown(e.key.toUpperCase())
      if (trace) announcePress(trace)
    }
    const up = (e: KeyboardEvent) => {
      if (machineStore.getState().heldKey === e.key.toUpperCase()) machineStore.getState().keyUp()
    }
    const release = () => machineStore.getState().keyUp()

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
    }
  }, [])
}
