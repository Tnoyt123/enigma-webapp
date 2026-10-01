/** Material props that make a part see-through in x-ray mode. */
export function xrayProps(xray: boolean, opacity: number) {
  return { transparent: xray, opacity: xray ? opacity : 1, depthWrite: !xray }
}

/** What the signal path currently shows, for browser tests (read through the ?e2e hook). */
export const pathInfo = { segments: 0, focus: null as string | null }
