export type View = '2d' | '3d'

export const DEFAULT_VIEW: View = '3d'
export const VIEW_PARAM = 'view'
export const VIEW_STORAGE_KEY = 'enigma.view'

export function parseView(value: string | null | undefined): View | null {
  const v = value?.trim().toLowerCase()
  return v === '2d' || v === '3d' ? v : null
}

export interface ViewChoice {
  readonly view: View
  /** Shown to the user when we couldn't honour what they asked for. */
  readonly notice: string | null
}

/** URL parameter beats the remembered choice, which beats the default; no WebGL forces 2D. */
export function chooseView(options: {
  readonly search: string
  readonly stored: string | null
  readonly webgl: boolean
}): ViewChoice {
  const requested =
    parseView(new URLSearchParams(options.search).get(VIEW_PARAM)) ??
    parseView(options.stored) ??
    DEFAULT_VIEW
  if (requested === '3d' && !options.webgl) {
    return {
      view: '2d',
      notice:
        "Your browser can't display the 3D machine (WebGL is unavailable), so the 2D machine is shown instead.",
    }
  }
  return { view: requested, notice: null }
}

/** Returns `search` with the view parameter set, keeping any other parameters. */
export function withViewParam(search: string, view: View): string {
  const params = new URLSearchParams(search)
  params.set(VIEW_PARAM, view)
  return `?${params}`
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
