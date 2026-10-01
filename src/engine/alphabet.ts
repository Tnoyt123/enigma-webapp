export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Letter index 0–25 → 'A'–'Z'. */
export function toLetter(index: number): string {
  return ALPHABET[mod26(index)]
}

/** 'A'–'Z' (case-insensitive) → 0–25. Throws on anything else. */
export function toIndex(letter: string): number {
  const i = ALPHABET.indexOf(letter.toUpperCase())
  if (letter.length !== 1 || i < 0)
    throw new RangeError(`Not a letter A–Z: ${JSON.stringify(letter)}`)
  return i
}

/** Mathematical modulo that is always in 0–25, including for negatives. */
export function mod26(n: number): number {
  return ((n % 26) + 26) % 26
}
