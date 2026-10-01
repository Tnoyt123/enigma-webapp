import { useMachine } from '../state/machineStore.ts'
import { KEY_ROWS } from './layout.ts'
import { announcePress } from './usePhysicalKeyboard.ts'
import { useRovingFocus } from './useRovingFocus.ts'

/** On-screen keys. The lamp stays lit while a key is held, as on the real machine. */
export function Keyboard() {
  const held = useMachine((s) => s.heldKey)
  const keyDown = useMachine((s) => s.keyDown)
  const keyUp = useMachine((s) => s.keyUp)
  const { itemProps } = useRovingFocus(KEY_ROWS)

  const press = (letter: string) => {
    const trace = keyDown(letter)
    if (trace) announcePress(trace)
  }

  return (
    <div
      role="group"
      aria-label="Keyboard"
      className="flex flex-col items-center gap-1.5 sm:gap-2 w-full"
    >
      {KEY_ROWS.map((row) => (
        <div key={row} className="flex w-full justify-center gap-[1.5%]">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              aria-label={`Key ${letter}`}
              data-held={held === letter || undefined}
              {...itemProps(letter)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                press(letter)
              }}
              onPointerUp={keyUp}
              onPointerCancel={keyUp}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                // detail is 0 for Enter/Space activation; pointer presses are handled above.
                if (e.detail !== 0) return
                press(letter)
                setTimeout(keyUp, 250)
              }}
              className="flex aspect-square w-[min(10%,2.5rem)] touch-manipulation items-center justify-center rounded-full border-2 border-stone-400 bg-stone-900 font-mono text-sm font-semibold text-stone-100 shadow-[0_3px_0_#0c0a09] transition-transform duration-75 outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-amber-300 data-held:translate-y-[3px] data-held:shadow-none sm:text-base"
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
