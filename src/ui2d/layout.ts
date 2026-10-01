/** Keyboard, lampboard and plugboard all use the German QWERTZ arrangement of the real machine. */
export const KEY_ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'] as const

/** Grid position of a letter, in key-width units, with the middle row inset by half a key. */
export function keyPosition(letter: string): { x: number; y: number } {
  const row = KEY_ROWS.findIndex((r) => r.includes(letter))
  const offset = (KEY_ROWS[0].length - KEY_ROWS[row].length) / 2
  return { x: offset + KEY_ROWS[row].indexOf(letter) + 0.5, y: row + 0.5 }
}

export const GRID_WIDTH = KEY_ROWS[0].length
export const GRID_HEIGHT = KEY_ROWS.length

/** Slot names, left to right, for 3- and 4-rotor machines. */
export function slotNames(slots: number): string[] {
  return slots === 4 ? ['Thin', 'Left', 'Middle', 'Right'] : ['Left', 'Middle', 'Right']
}
