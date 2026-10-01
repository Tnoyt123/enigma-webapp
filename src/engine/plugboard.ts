import { toIndex } from './alphabet.ts'

/** Builds the 26-entry substitution for a set of plugboard cables such as ['AV', 'BS']. */
export function plugboardMap(pairs: readonly string[]): number[] {
  const map = Array.from({ length: 26 }, (_, i) => i)
  for (const pair of pairs) {
    const a = toIndex(pair[0])
    const b = toIndex(pair[1])
    map[a] = b
    map[b] = a
  }
  return map
}

/** Splits "AV BS cg" into ['AV', 'BS', 'CG']. Validation happens in validateConfig. */
export function parsePlugboard(text: string): string[] {
  return text
    .toUpperCase()
    .split(/[\s,]+/)
    .filter((p) => p.length > 0)
}
