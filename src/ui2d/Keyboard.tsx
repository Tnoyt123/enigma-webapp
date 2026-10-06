import { useMachine } from '../state/machineStore.ts'
import { KEY_ROWS } from './layout.ts'
import { announcePress } from './usePhysicalKeyboard.ts'
import { DRAG_THRESHOLD } from './dragging.ts'
import { useRovingFocus } from './useRovingFocus.ts'

/** How long a finger rests on a key before it goes down (shorter than any deliberate scroll). */
const TOUCH_HOLD_MS = 90

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

  /**
   * On touch screens, a finger landing on the keyboard may be starting a scroll. So a key goes
   * down only once the finger has rested briefly, or on a clean tap, and never if it moves first.
   */
  const touchPress = (start: PointerEvent, letter: string) => {
    let down = false
    const finish = () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const timer = setTimeout(() => {
      down = true
      press(letter)
    }, TOUCH_HOLD_MS)
    const move = (e: PointerEvent) => {
      if (e.pointerId !== start.pointerId || down) return
      if (Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > DRAG_THRESHOLD) {
        finish() // it's a scroll
      }
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== start.pointerId) return
      finish()
      if (down) return keyUp()
      press(letter) // a quick tap: press, and show the lamp briefly
      setTimeout(keyUp, 200)
    }
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== start.pointerId) return
      finish()
      if (down) keyUp()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  return (
    <div
      role="group"
      aria-label="Keyboard"
      className="flex flex-col items-center gap-1.5 sm:gap-2 w-full"
    >
      {KEY_ROWS.map((row) => (
        <div key={row} className="flex w-full justify-center gap-[0.8%]">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              aria-label={`Key ${letter}`}
              data-held={held === letter || undefined}
              {...itemProps(letter)}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') return touchPress(e.nativeEvent, letter)
                e.currentTarget.setPointerCapture(e.pointerId)
                press(letter)
              }}
              onPointerUp={(e) => e.pointerType !== 'touch' && keyUp()}
              onPointerCancel={(e) => e.pointerType !== 'touch' && keyUp()}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                // detail is 0 for Enter/Space activation; pointer presses are handled above.
                if (e.detail !== 0) return
                press(letter)
                setTimeout(keyUp, 250)
              }}
              className="flex aspect-square w-[min(10.4%,2.75rem)] touch-manipulation items-center justify-center rounded-full border-2 border-stone-400 bg-stone-900 font-mono text-sm font-semibold text-stone-100 shadow-[0_3px_0_#0c0a09] transition-transform duration-75 outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-amber-300 data-held:translate-y-[3px] data-held:shadow-none sm:text-base"
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
