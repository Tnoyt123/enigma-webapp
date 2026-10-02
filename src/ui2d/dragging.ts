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
