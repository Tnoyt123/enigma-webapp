import { useCallback, useRef, useState, type KeyboardEvent } from 'react'

/**
 * Roving tabindex over a grid of letters: the whole grid is one Tab stop and the
 * arrow keys, Home and End move between letters.
 */
export function useRovingFocus(rows: readonly string[]) {
  const [active, setActive] = useState(rows[0][0])
  const elements = useRef(new Map<string, HTMLElement>())

  const focus = useCallback((letter: string) => {
    setActive(letter)
    elements.current.get(letter)?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent, letter: string) => {
    const r = rows.findIndex((row) => row.includes(letter))
    const c = rows[r].indexOf(letter)
    const near = (row: string | undefined) => row?.[Math.min(c, row.length - 1)]
    const moves: Record<string, () => string | undefined> = {
      ArrowRight: () => rows[r][c + 1],
      ArrowLeft: () => rows[r][c - 1],
      ArrowDown: () => near(rows[r + 1]),
      ArrowUp: () => near(rows[r - 1]),
      Home: () => rows[r][0],
      End: () => rows[r].at(-1),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const target = move()
    if (target) focus(target)
  }

  const itemProps = (letter: string) => ({
    tabIndex: letter === active ? 0 : -1,
    ref: (el: HTMLElement | null) => {
      if (el) elements.current.set(letter, el)
      else elements.current.delete(letter)
    },
    onFocus: () => setActive(letter),
    onKeyDown: (event: KeyboardEvent) => onKeyDown(event, letter),
  })

  return { itemProps, focus }
}
