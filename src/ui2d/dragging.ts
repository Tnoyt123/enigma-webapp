/** Pointer travel (px) before a press counts as a drag rather than a click. */
export const DRAG_THRESHOLD = 6

/** The element carrying `data-<attribute>` under a page point, ignoring whatever is being dragged. */
export function dropTargetAt(x: number, y: number, attribute: string): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const target = (el as HTMLElement).closest<HTMLElement>(`[data-${attribute}]`)
    if (target) return target
  }
  return null
}

/**
 * Follows a pointer from a press until it is released anywhere on the page.
 * `onMove` receives the distance travelled; `onUp` whether it ever passed the drag threshold.
 */
export function trackPointer(
  start: { clientX: number; clientY: number },
  handlers: {
    onMove?: (e: PointerEvent, dragged: boolean) => void
    onUp: (e: PointerEvent, dragged: boolean) => void
  },
): void {
  let dragged = false
  const move = (e: PointerEvent) => {
    if (
      !dragged &&
      Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > DRAG_THRESHOLD
    ) {
      dragged = true
    }
    handlers.onMove?.(e, dragged)
  }
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    handlers.onUp(e, dragged)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** How long a finger must rest before a touch becomes a drag instead of a scroll. */
export const LONG_PRESS_MS = 350

export interface PressHandlers {
  /** A press released without dragging: the same as a click. */
  onTap?: () => void
  /** The press became a drag (mouse: moved; touch: held still, then moved or kept holding). */
  onDragStart?: (e: PointerEvent) => void
  onDragMove?: (e: PointerEvent) => void
  /** Released after dragging. */
  onDrop?: (e: PointerEvent) => void
}

/**
 * One gesture for pressing on draggable things that works for mouse and touch alike.
 *
 * Mouse and pen: release without moving is a tap; moving past the threshold starts a drag.
 * Touch: the page must stay scrollable, so a finger that moves straight away is left to scroll
 * (and nothing happens here); a quick tap is a tap; resting for LONG_PRESS_MS starts a drag, and
 * from then on page scrolling is blocked so the finger drags instead. The element needs
 * `touch-action: pan-y` (or similar) so the browser can scroll it.
 */
export function startPress(start: PointerEvent, handlers: PressHandlers): void {
  const touch = start.pointerType === 'touch'
  let dragging = false
  let moved = false
  let ended = false
  let last = start

  const blockScroll = (e: TouchEvent) => {
    if (dragging) e.preventDefault()
  }
  const beginDrag = (e: PointerEvent) => {
    dragging = true
    if (touch) navigator.vibrate?.(10)
    handlers.onDragStart?.(e)
  }
  const timer = touch
    ? setTimeout(() => !moved && !ended && beginDrag(last), LONG_PRESS_MS)
    : undefined

  const move = (e: PointerEvent) => {
    if (e.pointerId !== start.pointerId) return
    last = e
    const far = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > DRAG_THRESHOLD
    if (!dragging && far) {
      moved = true
      if (!touch) beginDrag(e) // touch: an early move is a scroll, not a drag
    }
    if (dragging) handlers.onDragMove?.(e)
  }
  const finish = (e: PointerEvent) => {
    if (e.pointerId !== start.pointerId) return
    ended = true
    clearTimeout(timer)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    document.removeEventListener('touchmove', blockScroll)
  }
  const up = (e: PointerEvent) => {
    finish(e)
    if (dragging) handlers.onDrop?.(e)
    else if (!moved) handlers.onTap?.()
  }
  // The browser took the touch over for scrolling.
  const cancel = (e: PointerEvent) => {
    finish(e)
    if (dragging) handlers.onDrop?.(e)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  if (touch) document.addEventListener('touchmove', blockScroll, { passive: false })
}
