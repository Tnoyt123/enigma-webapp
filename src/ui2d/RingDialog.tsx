import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ALPHABET, mod26 } from '../engine/index.ts'
import { RingControls } from '../panels/RingControls.tsx'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { slotNames } from '../teaching/explain.ts'
import { trackPointer } from './dragging.ts'

const STEP = 360 / 26

/** 2D close-up of a rotor for setting its ring: a modal dialog with a draggable dial. */
export function RingDialog() {
  const slot = useMachine((s) => s.ringSlot)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (slot !== null && !d.open) {
      d.showModal()
      // showModal focuses the first button; start on the ring control itself.
      d.querySelector<HTMLElement>('[role="spinbutton"]')?.focus()
    }
    if (slot === null && d.open) d.close()
  }, [slot])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="ring-dialog-title"
      onClose={() => machineStore.getState().setRingSlot(null)}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-amber-50 p-4 shadow-2xl backdrop:bg-black/60"
    >
      {slot !== null && <RingDialogBody slot={slot} />}
    </dialog>
  )
}

function RingDialogBody({ slot }: { slot: number }) {
  const rotor = useMachine((s) => s.config.rotors[slot])
  const slots = useMachine((s) => s.config.rotors.length)
  return (
    <div className="flex flex-col gap-3">
      <h2 id="ring-dialog-title" className="font-serif text-xl font-bold text-stone-900">
        Ring setting: {slotNames(slots)[slot].toLowerCase()} rotor ({rotor})
      </h2>
      <RingDial slot={slot} />
      <RingControls slot={slot} />
    </div>
  )
}

/** The alphabet ring round the rotor core. Drag it round to change the ring setting. */
function RingDial({ slot }: { slot: number }) {
  const ring = useMachine((s) => s.config.rings[slot])
  const svg = useRef<SVGSVGElement>(null)

  const angleAt = (x: number, y: number) => {
    const r = svg.current!.getBoundingClientRect()
    return (Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180) / Math.PI
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = angleAt(e.clientX, e.clientY)
    const startRing = ring
    trackPointer(e, {
      onMove: (ev) => {
        let delta = angleAt(ev.clientX, ev.clientY) - start
        delta = ((delta + 540) % 360) - 180
        // Turning the ring clockwise brings the previous letter round to the dot.
        machineStore.getState().setRing(slot, mod26(startRing - Math.round(delta / STEP)))
      },
      onUp: () => {},
    })
  }

  return (
    <svg
      ref={svg}
      viewBox="-110 -110 220 220"
      className="mx-auto w-56 cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      aria-hidden="true"
      data-testid="ring-dial"
    >
      <circle r={104} fill="#ece6d6" stroke="#57534e" strokeWidth={2} />
      <circle r={74} fill="#2b2825" />
      <text y={6} textAnchor="middle" fontSize={13} fill="#d6d3d1">
        wiring
      </text>
      {/* Contact A of the wiring: fixed at the top. */}
      <circle cy={-62} r={6} fill="#dc2626" />
      {[...ALPHABET].map((letter, i) => {
        const a = ((i - ring) * STEP * Math.PI) / 180
        return (
          <text
            key={letter}
            x={Math.sin(a) * 89}
            y={-Math.cos(a) * 89 + 6}
            textAnchor="middle"
            fontSize={i === ring ? 19 : 15}
            fontWeight={i === ring ? 'bold' : 'normal'}
            fill={i === ring ? '#b45309' : '#1c1917'}
            fontFamily="ui-monospace, monospace"
          >
            {letter}
          </text>
        )
      })}
    </svg>
  )
}
