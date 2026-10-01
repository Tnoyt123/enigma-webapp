import { useState, type KeyboardEvent } from 'react'
import { mod26, toLetter } from '../engine/index.ts'
import { useMachine } from '../state/machineStore.ts'
import { slotNames } from './layout.ts'

/** The windows in the lid showing each rotor's current letter, with thumbwheels to turn them. */
export function RotorWindows() {
  const rotors = useMachine((s) => s.config.rotors)
  const positions = useMachine((s) => s.positions)
  const setPosition = useMachine((s) => s.setPosition)
  const names = slotNames(rotors.length)

  return (
    <div className="flex justify-center gap-3 sm:gap-5" role="group" aria-label="Rotor positions">
      {rotors.map((rotor, slot) => (
        <RotorWindow
          key={slot}
          label={`${names[slot]} rotor (${rotor})`}
          rotor={rotor}
          position={positions[slot]}
          onChange={(p) => setPosition(slot, mod26(p))}
        />
      ))}
    </div>
  )
}

function RotorWindow({
  label,
  rotor,
  position,
  onChange,
}: {
  label: string
  rotor: string
  position: number
  onChange: (position: number) => void
}) {
  // Remember the previous position (React's "adjust state during render" pattern) to animate the step.
  const [shown, setShown] = useState({ position, step: 0 })
  if (shown.position !== position) {
    const delta = mod26(position - shown.position)
    setShown({ position, step: delta === 1 ? 1 : delta === 25 ? -1 : 0 })
  }
  const stepAnimation =
    shown.step === 1
      ? 'motion-safe:animate-[rotor-step-forward_140ms_ease-out]'
      : shown.step === -1
        ? 'motion-safe:animate-[rotor-step-back_140ms_ease-out]'
        : ''

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    }[e.key]
    if (delta !== undefined) onChange(position + delta)
    else if (e.key === 'Home') onChange(0)
    else if (e.key === 'End') onChange(25)
    else if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      onChange(e.key.toUpperCase().charCodeAt(0) - 65)
    } else return
    e.preventDefault()
  }

  const wheelButton =
    'h-7 w-10 rounded text-stone-300 hover:bg-stone-700 hover:text-white active:bg-stone-600'

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold tracking-wider text-stone-300 uppercase">{rotor}</span>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className={wheelButton}
        onClick={() => onChange(position - 1)}
      >
        ▲
      </button>
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={26}
        aria-valuenow={position + 1}
        aria-valuetext={toLetter(position)}
        onKeyDown={onKeyDown}
        className="flex w-12 flex-col items-center overflow-hidden rounded-md border-2 border-stone-500 bg-stone-100 py-1 font-mono text-stone-900 shadow-inner outline-offset-4 select-none focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        <div
          key={position}
          className={`flex flex-col items-center ${stepAnimation}`}
          aria-hidden="true"
        >
          <span className="text-xs text-stone-500">{toLetter(position - 1)}</span>
          <span className="text-2xl font-bold">{toLetter(position)}</span>
          <span className="text-xs text-stone-500">{toLetter(position + 1)}</span>
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className={wheelButton}
        onClick={() => onChange(position + 1)}
      >
        ▼
      </button>
    </div>
  )
}
