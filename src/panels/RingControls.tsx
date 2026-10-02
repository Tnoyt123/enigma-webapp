import { useEffect, useRef, type KeyboardEvent } from 'react'
import { mod26, toLetter } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { slotNames } from '../teaching/explain.ts'

const button =
  'rounded border border-stone-500 bg-white px-3 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'

/** Turn the alphabet ring of one rotor against its wiring (shared by the 2D dialog and 3D close-up). */
export function RingControls({ slot }: { slot: number }) {
  const rotor = useMachine((s) => s.config.rotors[slot])
  const ring = useMachine((s) => s.config.rings[slot])
  const slots = useMachine((s) => s.config.rotors.length)
  const name = slotNames(slots)[slot]
  const spin = useRef<HTMLDivElement>(null)
  const set = (value: number) => machineStore.getState().setRing(slot, mod26(value))

  // Focus the ring control when the close-up opens.
  useEffect(() => spin.current?.focus(), [slot])

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
    if (delta !== undefined) set(ring + delta)
    else if (e.key === 'Home') set(0)
    else if (e.key === 'End') set(25)
    else if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      set(e.key.toUpperCase().charCodeAt(0) - 65)
    } else return
    e.preventDefault()
  }

  return (
    <div className="flex flex-col gap-3 text-stone-900">
      <div className="flex items-center justify-center gap-3">
        <button type="button" className={button} onClick={() => set(ring - 1)}>
          ◀ Back
        </button>
        <div
          ref={spin}
          role="spinbutton"
          tabIndex={0}
          aria-label={`Ring setting, ${name.toLowerCase()} rotor (${rotor})`}
          aria-valuemin={1}
          aria-valuemax={26}
          aria-valuenow={ring + 1}
          aria-valuetext={`${toLetter(ring)}, ${String(ring + 1).padStart(2, '0')}`}
          onKeyDown={onKeyDown}
          className="min-w-20 rounded-md border-2 border-stone-500 bg-white px-3 py-1 text-center font-mono text-2xl font-bold outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          {toLetter(ring)}
          <span className="ml-1 text-sm font-normal text-stone-600">
            {String(ring + 1).padStart(2, '0')}
          </span>
        </div>
        <button type="button" className={button} onClick={() => set(ring + 1)}>
          Forward ▶
        </button>
      </div>
      <p className="text-sm text-stone-700">
        The alphabet ring turns against the wiring inside. With ring {toLetter(ring)}, the wiring's
        contact A (the red dot) sits under letter {toLetter(ring)}, so every letter in the window is
        shifted {ring} step{ring === 1 ? '' : 's'} from the wiring. The notch is on the ring, so it
        still turns the next rotor at the same window letter.
      </p>
      <button
        type="button"
        className={`${button} self-end`}
        onClick={() => machineStore.getState().setRingSlot(null)}
      >
        Done
      </button>
    </div>
  )
}
