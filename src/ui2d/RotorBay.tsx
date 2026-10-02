import { useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { REFLECTORS, toLetter, type RotorId } from '../engine/index.ts'
import { boxRotors, machineStore, useMachine } from '../state/machineStore.ts'
import { slotNames } from '../teaching/explain.ts'
import { announce } from './announce.ts'
import { dropTargetAt, trackPointer } from './dragging.ts'

const rotorFace =
  'flex w-14 flex-col items-center gap-0.5 rounded-md border-2 bg-stone-200 px-1 py-2 font-mono text-stone-900 shadow'
const focusRing = 'outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300'

/**
 * The machine with its lid open: lift rotors out, swap them, or exchange them with the rotor box.
 * Works by drag and drop, by clicking (pick up, then put down), or from the keyboard.
 * `compact` leaves out the ring buttons and status line, for the 3D view, which shows its own.
 */
export function RotorBay({ compact = false }: { compact?: boolean }) {
  const config = useMachine((s) => s.config)
  const positions = useMachine((s) => s.positions)
  const hand = useMachine((s) => s.hand)
  const message = useMachine((s) => s.rotorMessage)
  const boxRings = useMachine((s) => s.boxRings)
  const names = slotNames(config.rotors.length)
  const box = boxRotors(config)
  const [ghost, setGhost] = useState<{ x: number; y: number; rotor: RotorId } | null>(null)

  const say = (text: string | null) => text && announce(text)
  const store = () => machineStore.getState()

  /** Press on a rotor: pick it up and follow the pointer until it is dropped. */
  const startDrag = (e: ReactPointerEvent, rotor: RotorId) => {
    trackPointer(e, {
      onMove: (ev, dragged) => dragged && setGhost({ x: ev.clientX, y: ev.clientY, rotor }),
      onUp: (ev, dragged) => {
        setGhost(null)
        if (!dragged) return // a click: keep holding it until the next click
        const slot = dropTargetAt(ev.clientX, ev.clientY, 'rotor-slot')
        if (slot) say(store().placeRotor(Number(slot.dataset.rotorSlot)))
        else say(store().returnRotor()) // dropped on the box or nowhere: back where it came from
      },
    })
  }

  const onSlotPointerDown = (e: ReactPointerEvent, slot: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (store().hand) return say(store().placeRotor(slot))
    say(store().liftRotor(slot))
    startDrag(e, config.rotors[slot])
  }

  const onBoxPointerDown = (e: ReactPointerEvent, rotor: RotorId) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (store().hand) store().returnRotor()
    say(store().liftRotor('box', rotor))
    startDrag(e, rotor)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && store().hand) {
      e.preventDefault()
      say(store().returnRotor())
    }
  }

  return (
    <div className="flex flex-col gap-3" onKeyDown={onKeyDown} data-testid="rotor-bay">
      <div role="group" aria-label="Rotor slots" className="flex items-end justify-center gap-2">
        <Fixed label="UKW" sub={REFLECTORS[config.reflector].name.replace('UKW-', '')} />
        {config.rotors.map((rotor, slot) => {
          const lifted = hand?.from === slot
          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              <span className="text-xs text-stone-300">{names[slot]}</span>
              <button
                type="button"
                data-rotor-slot={slot}
                aria-label={
                  lifted
                    ? `${names[slot]} slot, empty: rotor ${rotor} is lifted out`
                    : `${names[slot]} slot: rotor ${rotor}${hand ? `. Put rotor ${hand.rotor} here` : ''}`
                }
                onPointerDown={(e) => onSlotPointerDown(e, slot)}
                onClick={(e) => {
                  if (e.detail !== 0) return // pointer presses are handled on pointer down
                  say(store().hand ? store().placeRotor(slot) : store().liftRotor(slot))
                }}
                className={`${rotorFace} ${focusRing} touch-none ${
                  lifted
                    ? 'border-dashed border-stone-500 bg-transparent text-stone-400 shadow-none'
                    : hand
                      ? 'border-amber-400'
                      : 'border-stone-500'
                }`}
              >
                <span className="text-lg font-bold">{lifted ? '—' : rotor}</span>
                <span className="text-[0.65rem]" aria-hidden="true">
                  {lifted ? 'empty' : `at ${toLetter(positions[slot])}`}
                </span>
                <span className="text-[0.65rem]" aria-hidden="true">
                  {lifted ? '' : `ring ${toLetter(config.rings[slot])}`}
                </span>
              </button>
              {!compact && (
                <button
                  type="button"
                  onClick={() => store().setRingSlot(slot)}
                  className={`rounded px-1.5 py-0.5 text-xs text-stone-200 underline hover:bg-stone-700 ${focusRing}`}
                  aria-label={`Set ring for the ${names[slot].toLowerCase()} rotor (${rotor})`}
                >
                  Ring…
                </button>
              )}
            </div>
          )
        })}
        <Fixed label="ETW" sub="" />
      </div>

      <div
        role="group"
        aria-label="Rotor box"
        data-rotor-box
        className="flex flex-wrap items-center justify-center gap-2 rounded-lg border-2 border-[#5c3a1e] bg-[#2a1d12] p-2"
      >
        <span className="w-full text-center text-xs tracking-widest text-stone-300 uppercase">
          Rotor box
        </span>
        {box.length === 0 && <span className="text-sm text-stone-400">Empty</span>}
        {box.map((rotor) => {
          const held = hand?.from === 'box' && hand.rotor === rotor
          return (
            <button
              key={rotor}
              type="button"
              aria-label={`Rotor ${rotor}, in the box, ring ${toLetter(boxRings[rotor] ?? 0)}${held ? ', picked up' : ''}`}
              aria-pressed={held}
              onPointerDown={(e) => onBoxPointerDown(e, rotor)}
              onClick={(e) => {
                if (e.detail !== 0) return
                if (store().hand) store().returnRotor()
                say(store().liftRotor('box', rotor))
              }}
              className={`${rotorFace} ${focusRing} touch-none py-1 ${
                held ? 'border-amber-400 bg-amber-100' : 'border-stone-500'
              }`}
            >
              <span className="text-base font-bold">{rotor}</span>
              <span className="text-[0.65rem]" aria-hidden="true">
                ring {toLetter(boxRings[rotor] ?? 0)}
              </span>
            </button>
          )
        })}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-center text-sm text-stone-300" data-testid="rotor-message">
            {message}
          </p>
          {hand && (
            <button
              type="button"
              onClick={() => say(store().returnRotor())}
              className={`rounded border border-stone-500 px-2 py-0.5 text-sm text-stone-100 hover:bg-stone-700 ${focusRing}`}
            >
              Put rotor {hand.rotor} back
            </button>
          )}
        </div>
      )}

      {ghost && (
        <div
          aria-hidden="true"
          data-testid="rotor-ghost"
          className="pointer-events-none fixed z-50 flex size-12 -translate-1/2 items-center justify-center rounded-md border-2 border-amber-400 bg-stone-200 font-mono text-lg font-bold text-stone-900 shadow-xl"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.rotor}
        </div>
      )}
    </div>
  )
}

function Fixed({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      aria-hidden="true"
      className="mb-6 flex h-16 w-9 flex-col items-center justify-center rounded-md bg-stone-600 font-mono text-xs text-stone-100"
    >
      <span className="font-bold">{label}</span>
      <span>{sub}</span>
    </div>
  )
}
