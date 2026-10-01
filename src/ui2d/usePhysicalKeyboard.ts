import { useEffect } from 'react'
import { machineStore } from '../state/machineStore.ts'
import { announce } from './announce.ts'

/** Elements that use letter keys themselves, so typing there must not press machine keys. */
const OWN_LETTER_KEYS =
  'input, textarea, select, [contenteditable], [role="spinbutton"], [data-own-letter-keys]'

/** Announces a key press for screen-reader users. */
export function announcePress(input: string, output: string, positions: string) {
  announce(`${input} lights ${output}. Rotors ${[...positions].join(' ')}.`)
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
      if (trace) announcePress(trace.input, trace.output, trace.positionsAfter)
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
