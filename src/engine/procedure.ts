/** Splits letters into the fixed-width groups operators transmitted, e.g. "ABCDE FGHIJ KL". */
export function toGroups(letters: string, size = 5): string {
  return (
    letters
      .replace(/[^A-Z]/gi, '')
      .toUpperCase()
      .match(new RegExp(`.{1,${size}}`, 'g'))
      ?.join(' ') ?? ''
  )
}
