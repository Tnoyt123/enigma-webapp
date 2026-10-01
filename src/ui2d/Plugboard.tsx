import type { KeyboardEvent } from 'react'
import { MAX_CABLES, machineStore, useMachine } from '../state/machineStore.ts'
import { announce } from './announce.ts'
import { CABLE_COLORS, GRID_HEIGHT, GRID_WIDTH, KEY_ROWS, keyPosition } from './layout.ts'
import { useRovingFocus } from './useRovingFocus.ts'

/** Steckerbrett: click one socket, then another, to plug a cable between them; click a plugged socket to unplug. */
export function Plugboard() {
  const pairs = useMachine((s) => s.config.plugboard)
  const selected = useMachine((s) => s.plugSelection)
  const message = useMachine((s) => s.plugMessage)
  const { itemProps, focus } = useRovingFocus(KEY_ROWS)

  const partnerOf = (letter: string) => pairs.find((p) => p.includes(letter))?.replace(letter, '')
  const colorOf = (letter: string) => {
    const i = pairs.findIndex((p) => p.includes(letter))
    return i < 0 ? undefined : CABLE_COLORS[i % CABLE_COLORS.length]
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const message = machineStore.getState().cancelPlug()
      if (message) announce(message)
    } else if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing a letter jumps to its socket.
      e.preventDefault()
      focus(e.key.toUpperCase())
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Plugboard, ${pairs.length} of ${MAX_CABLES} cables`}
        aria-describedby="plugboard-help"
        data-own-letter-keys
        onKeyDown={onKeyDown}
        className="relative mx-auto w-full max-w-md"
        style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}
      >
        <svg
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {pairs.map((pair, i) => {
            const a = keyPosition(pair[0])
            const b = keyPosition(pair[1])
            const sag = 0.4 + Math.hypot(b.x - a.x, b.y - a.y) * 0.12
            const d = `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.max(a.y, b.y) + sag} ${b.x} ${b.y}`
            return (
              <path
                key={pair}
                d={d}
                fill="none"
                stroke={CABLE_COLORS[i % CABLE_COLORS.length]}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.8}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        {KEY_ROWS.join('')
          .split('')
          .map((letter) => {
            const { x, y } = keyPosition(letter)
            const partner = partnerOf(letter)
            return (
              <button
                key={letter}
                type="button"
                data-socket={letter}
                aria-label={
                  partner ? `Socket ${letter}, plugged to ${partner}` : `Socket ${letter}, empty`
                }
                aria-pressed={selected === letter}
                {...itemProps(letter)}
                onClick={() => announce(machineStore.getState().activateSocket(letter))}
                className="absolute flex size-[9%] min-h-7 min-w-7 -translate-1/2 items-center justify-center rounded-md border-2 border-stone-500 bg-stone-800 font-mono text-xs font-semibold text-stone-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300 aria-pressed:border-amber-300 aria-pressed:bg-amber-900 sm:text-sm"
                style={{
                  left: `${(x / GRID_WIDTH) * 100}%`,
                  top: `${(y / GRID_HEIGHT) * 100}%`,
                  borderColor: colorOf(letter),
                }}
              >
                {letter}
              </button>
            )
          })}
      </div>
      <p id="plugboard-help" className="text-center text-sm text-stone-300">
        {message}
      </p>
    </div>
  )
}
